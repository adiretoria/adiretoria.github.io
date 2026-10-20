// Exporta para dados/ofertas.json as ofertas que o robô (radar-ofertas) publicou nos grupos e, com --publicar,
// envia ao GitHub (o GitHub Pages atualiza o site sozinho). O banco do robô é aberto SÓ PARA LEITURA.
// Uso: node exportador/exportar.js [--publicar]
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { categoriaDoNome, CATEGORIAS, cupomVigente, linkLoja } from '../regras.js';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const SAIDA = `${RAIZ}dados/ofertas.json`;
export const config = JSON.parse(readFileSync(new URL('./config.json', import.meta.url), 'utf8'));

// Só links https das lojas atendidas, sem porta: o site nunca manda o visitante para outro lugar.
export const linkSeguro = linkLoja;
const imagemSegura = (u) => (/^https:\/\/[^\s"'<>()]+$/.test(u ?? '') ? u : null);
const iso = (s) => {
  if (!s) return null;
  const texto=String(s).replace(' ','T');
  const ms=Date.parse(/[zZ]$|[+-]\d\d:\d\d$/.test(texto) ? texto : `${texto}Z`);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
};
const json = (s) => { try { return JSON.parse(s ?? 'null') ?? {}; } catch { return {}; } };
const positivo = n => Number.isFinite(n) && n > 0 ? n : null;
const textoCurto = (s, max=200) => typeof s === 'string' ? s.trim().slice(0,max) || null : null;
function cupomPublico(s) {
  const c=json(s);
  if (!['pct','fixo'].includes(c.tipo) || !positivo(c.valor)) return null;
  const cond=typeof c.condicoes==='string'?json(c.condicoes):c.condicoes;
  const restricoes=[];
  if(cond?.prime)restricoes.push('exclusivo para membros Prime');
  if(cond?.aplicativo)restricoes.push('uso pelo aplicativo');
  if(cond?.primeira_compra)restricoes.push('somente primeira compra');
  if(cond?.produtos?.length||cond?.vendedores?.length||cond?.categorias?.length)restricoes.push('produtos, vendedores ou categorias selecionados');
  if(cond?.disponivel===false)restricoes.push('indisponível na última verificação');
  if(c.condicoes&&!restricoes.length)restricoes.push('confira as regras adicionais na loja');
  return {tipo:c.tipo,valor:c.valor,codigo:textoCurto(c.codigo,80),minimo:positivo(c.minimo_cent),teto:positivo(c.teto_cent),
    validade:textoCurto(c.validade,40),automatico:c.automatico === 1 || c.automatico === true,
    // A coleta não comprova a elegibilidade individual. Não exportar uma confirmação presumida.
    elegibilidadeConfirmada:false,condicoes:restricoes.join('; ')||null};
}
// Selo com marcador não preenchido pela loja ("{amount} OFF com Cupom") não vai para o site.
const selo = (s) => String(s ?? '').split(' · ').filter((x) => x && !/[{}]/.test(x)).join(' · ').slice(0, 140) || null;
const NOME_LOJA = { amazon: 'Amazon', shopee: 'Shopee', mercadolivre: 'Mercado Livre', magalu: 'Magalu' };

// Amazon (Contrato Operacional e Políticas do Programa de Associados Amazon.com.br):
// - preço, disponibilidade e imagem só podem ser exibidos se vierem da API da Amazon; o robô não usa a API,
//   então o site mostra só o nome e um link direto amazon.com.br/dp/ASIN com a tag (sem encurtador);
// - nada de selo de histórico/menor preço (rastreamento de preço é proibido);
// - só entra com a conta ativa e a tag informada em config.json (amazon.ativo / amazon.tag).
export function linkAmazon(url, tag = config.amazon?.tag) {
  const seguro = linkLoja(url, 'amazon');
  const asin = seguro && new URL(seguro).pathname.match(/\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})(?:\/|$)/i)?.[1]?.toUpperCase();
  return asin && /^[a-z0-9][a-z0-9-]{1,60}-20$/.test(tag ?? '') ? { asin, link: `https://www.amazon.com.br/dp/${asin}?tag=${tag}` } : null;
}
const amazonAtiva = () => config.amazon?.ativo === true && !!linkAmazon('https://www.amazon.com.br/dp/B000000000');

// Ofertas: publicadas (confirmadas pelo canal) nos últimos N dias, sem revisão pendente, com preço e link de loja.
// Publicação e coleta têm datas distintas: uma coleta posterior pode atualizar o registro da oferta.
export function montarDados(db) {
  const ofertas = db.prepare(`select id, loja, nome, preco_cent, preco_original_cent, preco_pix_cent, imagem, afiliado, selo, cupom_loja, enviado_em,
    coletado, editado_em, categoria, fonte, dados_comerciais
    from ofertas where enviado_em >= datetime('now', ?) and revisao is null and preco_cent > 0 and nome is not null
    order by enviado_em desc limit ?`).all(`-${config.dias} days`, config.maxOfertas).map((o) => {
    if (o.loja === 'amazon') {
      const amz = amazonAtiva() && linkAmazon(o.afiliado);
      return amz ? { id: o.id, loja: 'amazon', nome: o.nome.trim().slice(0, 220), asin: amz.asin, link: amz.link, em: iso(o.enviado_em) } : null;
    }
    const link = linkLoja(o.afiliado, o.loja);
    if (!link || !NOME_LOJA[o.loja]) return null;
    const cupom = cupomPublico(o.cupom_loja);
    const comerciais = json(o.dados_comerciais);
    const condicoesLoja = ['parcelamento','condicoes_pagamento','preco_unidade','programe_poupe'].map(k=>textoCurto(comerciais[k])).filter(Boolean);
    const seloNormalizado=String(o.selo ?? '').replace(/\s+/g,' ');
    if(/com Saldo no Mercado Pago/i.test(seloNormalizado)) condicoesLoja.push(`A loja anuncia ${seloNormalizado}. Confira a elegibilidade e se o desconto se aplica ao preço; nenhum desconto extra foi calculado.`);
    const coleta = [iso(o.coletado),iso(o.editado_em)].filter(Boolean).sort().at(-1) ?? null;
    const minimo = seloNormalizado.match(/Cupom de (?:(\d+(?:[.,]\d+)?)%|R\$\s*([\d.,]+))\s+(?:OFF\s+)?em compras acima de R\$\s*([\d.,]+)/i);
    const moeda = s=>Number(s.replace(/\./g,'').replace(',','.'));
    const cupomMinimo = minimo ? {tipo:minimo[1]?'pct':'fixo',valor:minimo[1]?Number(minimo[1].replace(',','.')):moeda(minimo[2]),minimo:Math.round(moeda(minimo[3])*100)} : null;
    return {
      id: o.id, loja: o.loja, nome: o.nome.trim().slice(0, 220), preco: o.preco_cent,
      de: o.preco_original_cent > o.preco_cent ? o.preco_original_cent : null,
      pix: o.preco_pix_cent > 0 && o.preco_pix_cent < o.preco_cent ? o.preco_pix_cent : null,
      img: imagemSegura(o.imagem), link, selo: selo(o.selo), cupom, cupomMinimo,
      jaComCupom:/preço já com o cupom/i.test(o.selo ?? ''),
      cupomAnunciado:/\bOFF com Cupom\b/i.test(o.selo ?? ''),condicoesLoja,
      categoria:Object.hasOwn(CATEGORIAS,o.categoria) ? o.categoria : categoriaDoNome(o.nome),
      origem:/^busca\b/i.test(o.fonte ?? '') ? 'automatica' : /manual/i.test(o.fonte ?? '') ? 'manual' : null,
      em: iso(o.enviado_em),conferido:coleta,
    };
  }).filter(Boolean);

  // Cupons: publicados nos grupos e ainda válidos, com o mesmo link de compra (afiliado) que foi para o grupo.
  // Campanha de comissão da Shopee não é desconto para o cliente: fica fora.
  const textoDoCupom = db.prepare('select texto from envios where cupom_id = ? order by id desc limit 1');
  const textoLegado = db.prepare('select texto from envios where cupom_id is null and origem = ? order by id desc limit 1');
  const cupons = db.prepare(`select id, loja, campanha, titulo, subtitulo, tipo, valor, minimo_cent, teto_cent, validade, enviado_em
    from cupons_lojas where enviado_em >= datetime('now', ?) and coalesce(tipo, '') != 'comissao'
    order by enviado_em desc limit 200`).all(`-${config.dias} days`).filter(c=>cupomVigente(c)).map((c) => {
    const texto = (textoDoCupom.get(c.id) ?? textoLegado.get(`cupom ${NOME_LOJA[c.loja]} #${c.campanha}`))?.texto ?? '';
    const link = (texto.match(/https:\/\/[^\s*<>]+/g) ?? []).map(u=>linkLoja(u,c.loja)).find(Boolean);
    if (!link || !NOME_LOJA[c.loja] || c.loja === 'amazon') return null; // cupom da Amazon: sem fonte oficial
    return {
      id: c.id, loja: c.loja, titulo: String(c.titulo ?? '').slice(0, 160), detalhe: c.subtitulo?.slice(0, 200) ?? null,
      valor: c.valor, tipo: c.tipo, minimo: c.minimo_cent, teto: c.teto_cent, validade: c.validade, link, em: iso(c.enviado_em),
    };
  }).filter(Boolean).slice(0,100);

  const grupos = Object.fromEntries(Object.entries(config.grupos).filter(([, u]) => /^https:\/\/(chat\.whatsapp\.com|whatsapp\.com|t\.me)\//.test(u)));
  return { grupos, amazon: amazonAtiva() ? { tag: config.amazon.tag } : null, ofertas, cupons };
}

function git(...args) {
  return execFileSync('git', args, { cwd: RAIZ, encoding: 'utf8' }).trim();
}

// Grava só se o conteúdo mudou (o horário de geração não conta) e, com --publicar, faz commit e push.
// Caminho relativo do banco vale a partir da pasta do site (por padrão, o robô fica na pasta irmã).
export function exportar({ publicar = false, banco = process.env.RADAR_DB ?? config.banco } = {}) {
  const db = new DatabaseSync(resolve(RAIZ, banco), { readOnly: true });
  db.exec('pragma busy_timeout = 5000');
  let dados;
  try {
    dados = montarDados(db);
  } finally {
    db.close();
  }
  const anterior = existsSync(SAIDA) ? JSON.parse(readFileSync(SAIDA, 'utf8')) : null;
  const igual = anterior && JSON.stringify({ ...anterior, geradoEm: null }) === JSON.stringify({ ...dados, geradoEm: null });
  if (!igual) writeFileSync(SAIDA, `${JSON.stringify({ geradoEm: new Date().toISOString(), ...dados })}\n`);
  if (publicar) {
    git('add', 'dados/ofertas.json');
    if (git('diff','--cached','--name-only','--','dados/ofertas.json')) git('commit', '--only', 'dados/ofertas.json', '-m', `dados: ${dados.ofertas.length} ofertas e ${dados.cupons.length} cupons`);
    git('push', '--quiet', 'origin', 'main');
  }
  return { mudou: !igual, ofertas: dados.ofertas.length, cupons: dados.cupons.length };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    console.log(new Date().toISOString(), JSON.stringify(exportar({ publicar: process.argv.includes('--publicar') })));
  } catch (e) {
    console.error(new Date().toISOString(), 'falhou:', e.message);
    process.exitCode = 1;
  }
}
