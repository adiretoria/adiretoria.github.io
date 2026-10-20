// Exporta para dados/ofertas.json as ofertas que o robô (radar-ofertas) publicou nos grupos e, com --publicar,
// envia ao GitHub (o GitHub Pages atualiza o site sozinho). O banco do robô é aberto SÓ PARA LEITURA.
// Uso: node exportador/exportar.js [--publicar]
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const SAIDA = `${RAIZ}dados/ofertas.json`;
export const config = JSON.parse(readFileSync(new URL('./config.json', import.meta.url), 'utf8'));

// Só links https das lojas atendidas, sem porta: o site nunca manda o visitante para outro lugar.
const HOSTS = ['amazon.com.br', 'amzn.to', 'shopee.com.br', 'shope.ee', 'mercadolivre.com.br', 'meli.la', 'magazinevoce.com.br', 'magazineluiza.com.br'];
export function linkSeguro(u) {
  const x = URL.parse(String(u ?? ''));
  return x && x.protocol === 'https:' && !x.port && !x.username && HOSTS.some((h) => x.hostname === h || x.hostname.endsWith(`.${h}`)) ? x.href : null;
}
const imagemSegura = (u) => (/^https:\/\/[^\s"'<>()]+$/.test(u ?? '') ? u : null);
const iso = (s) => (s ? `${s.replace(' ', 'T')}${s.endsWith('Z') ? '' : 'Z'}` : null);
// Selo com marcador não preenchido pela loja ("{amount} OFF com Cupom") não vai para o site.
const selo = (s) => String(s ?? '').split(' · ').filter((x) => x && !/[{}]/.test(x)).join(' · ').slice(0, 140) || null;
const NOME_LOJA = { amazon: 'Amazon', shopee: 'Shopee', mercadolivre: 'Mercado Livre', magalu: 'Magalu' };

// Ofertas: publicadas (confirmadas pelo canal) nos últimos N dias, sem revisão pendente, com preço e link de loja.
// "em" é quando a oferta foi publicada no grupo: o site mostra o preço daquele momento, não um preço atual.
export function montarDados(db) {
  const ofertas = db.prepare(`select id, loja, nome, preco_cent, preco_original_cent, preco_pix_cent, imagem, afiliado, selo, cupom_loja, enviado_em
    from ofertas where enviado_em >= datetime('now', ?) and revisao is null and preco_cent > 0 and nome is not null
    order by enviado_em desc limit ?`).all(`-${config.dias} days`, config.maxOfertas).map((o) => {
    const link = linkSeguro(o.afiliado);
    if (!link || !NOME_LOJA[o.loja]) return null;
    let cupom = null;
    try {
      const c = o.cupom_loja ? JSON.parse(o.cupom_loja) : null;
      cupom = c?.codigo ? `Cupom ${c.codigo}` : c?.texto ?? null;
    } catch {}
    return {
      id: o.id, loja: o.loja, nome: o.nome.trim().slice(0, 220), preco: o.preco_cent,
      de: o.preco_original_cent > o.preco_cent ? o.preco_original_cent : null,
      pix: o.preco_pix_cent > 0 && o.preco_pix_cent < o.preco_cent ? o.preco_pix_cent : null,
      img: imagemSegura(o.imagem), link, selo: selo(o.selo), cupom: cupom?.slice(0, 160) ?? null, em: iso(o.enviado_em),
    };
  }).filter(Boolean);

  // Cupons: publicados nos grupos e ainda válidos, com o mesmo link de compra (afiliado) que foi para o grupo.
  // Campanha de comissão da Shopee não é desconto para o cliente: fica fora.
  const textoDoCupom = db.prepare("select texto from envios where cupom_id = ? or origem like ? order by id desc limit 1");
  const cupons = db.prepare(`select id, loja, campanha, titulo, subtitulo, tipo, valor, minimo_cent, teto_cent, validade, enviado_em
    from cupons_lojas where enviado_em >= datetime('now', ?) and coalesce(tipo, '') != 'comissao'
    and (validade is null or validade > strftime('%Y-%m-%dT%H:%M:%SZ', 'now')) order by enviado_em desc limit 100`).all(`-${config.dias} days`).map((c) => {
    const texto = textoDoCupom.get(c.id, `cupom %#${c.campanha}`)?.texto ?? '';
    const link = (texto.match(/https:\/\/[^\s*~_]+/g) ?? []).map(linkSeguro).find(Boolean);
    if (!link || !NOME_LOJA[c.loja]) return null;
    return {
      id: c.id, loja: c.loja, titulo: String(c.titulo ?? '').slice(0, 160), detalhe: c.subtitulo?.slice(0, 200) ?? null,
      valor: c.valor, tipo: c.tipo, minimo: c.minimo_cent, teto: c.teto_cent, validade: c.validade, link, em: iso(c.enviado_em),
    };
  }).filter(Boolean);

  const grupos = Object.fromEntries(Object.entries(config.grupos).filter(([, u]) => /^https:\/\/(chat\.whatsapp\.com|whatsapp\.com|t\.me)\//.test(u)));
  return { grupos, ofertas, cupons };
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
  if (igual) return { mudou: false, ofertas: dados.ofertas.length, cupons: dados.cupons.length };
  writeFileSync(SAIDA, `${JSON.stringify({ geradoEm: new Date().toISOString(), ...dados })}\n`);
  if (publicar) {
    git('add', 'dados/ofertas.json');
    git('commit', '-m', `dados: ${dados.ofertas.length} ofertas e ${dados.cupons.length} cupons`);
    git('push', '--quiet', 'origin', 'main');
  }
  return { mudou: true, ofertas: dados.ofertas.length, cupons: dados.cupons.length };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    console.log(new Date().toISOString(), JSON.stringify(exportar({ publicar: process.argv.includes('--publicar') })));
  } catch (e) {
    console.error(new Date().toISOString(), 'falhou:', e.message);
    process.exitCode = 1;
  }
}
