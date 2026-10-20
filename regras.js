// Regras de preço, cupom, categoria, atualidade e curadoria. Funções puras: usadas pelo site (navegador) e
// pelo exportador e pelos testes (Node). Nada aqui inventa dado: o que a fonte não informa vira condição a
// conferir, nunca um preço calculado.

export const LOJAS = { mercadolivre: 'Mercado Livre', amazon: 'Amazon', shopee: 'Shopee', magalu: 'Magalu' };
const HOSTS = {amazon:['amazon.com.br','amzn.to'],shopee:['shopee.com.br','shope.ee'],mercadolivre:['mercadolivre.com.br','meli.la'],magalu:['magazinevoce.com.br','magazineluiza.com.br']};
export function linkLoja(u, loja) {
  try {
    const x = new URL(String(u ?? ''));
    const hosts = loja ? HOSTS[loja] ?? [] : Object.values(HOSTS).flat();
    return x.protocol === 'https:' && !x.port && !x.username && !x.password && hosts.some(h => x.hostname === h || x.hostname.endsWith(`.${h}`)) ? x.href : null;
  } catch { return null; }
}
const HORA = 3_600_000;
export const VALIDADE_PRECO_H = 24; // preço conferido há mais tempo que isso: "confira na loja", fora dos destaques
export const RECENTE_H = 48; // publicada há menos que isso: aparece por padrão; o resto fica em "ofertas anteriores"

export const reais = (c) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dataCurta = (iso) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' });
const dataHora = (iso) => new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
export const semAcento = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Desconto sobre o "De" informado pela loja, calculado sobre o preço normal (não o Pix nem o cupom): é o
// número mais conservador que os dados sustentam.
const positivo = (n) => Number.isFinite(n) && n > 0;
export const desconto = (o) => (positivo(o.de) && positivo(o.preco) && o.de > o.preco ? Math.round((1 - o.preco / o.de) * 100) : 0);

// Datas sem hora significam o fim daquele dia no horário de Brasília.
export function fimValidade(iso) {
  return Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(iso ?? '') ? `${iso}T23:59:59.999-03:00` : iso);
}
export const cupomVigente = (c, agora = Date.now()) => !c.validade || fimValidade(c.validade) > agora;

const nomeCupom = (c) => (c.tipo === 'pct' ? `${String(c.valor).replace('.', ',')}% OFF` : `${reais(Math.round(c.valor * 100))} OFF`);
const descontoCupom = (c, base) => {
  const bruto = c.tipo === 'pct' ? Math.round(base * c.valor / 100) : Math.round(c.valor * 100);
  return Math.min(bruto, c.teto ?? Infinity, base);
};

// Preço principal (com a condição escrita), preços alternativos e condições que não viram preço.
// Regras: cupom só vira preço se o produto sozinho atinge o mínimo e o cupom está válido; cupom já incluído no
// preço não é descontado de novo; Pix e cupom nunca são somados (a loja não informa se acumulam).
export function precoComCondicoes(o, agora = Date.now()) {
  if (!positivo(o.preco)) return null;
  const opcoes = [];
  const condicoes = [];
  if(o.cupomAnunciado && !o.cupom) condicoes.push('A loja anuncia um cupom, mas não informa suas regras completas. Confira sua elegibilidade; nenhum desconto extra foi calculado.');
  const temPix = positivo(o.pix) && o.pix < o.preco;
  const normal = { valor: o.preco, rotulo: o.rotuloPreco || (temPix ? 'nas demais formas de pagamento' : 'na loja') };
  if (temPix && !o.jaComCupom) opcoes.push({ valor: o.pix, rotulo: 'no Pix', tipo: 'pix' });
  if (o.jaComCupom) {
    normal.rotulo = 'com cupom da loja já aplicado';
    condicoes.push('O preço já considera um cupom da loja: confira a elegibilidade e ative-o na página do produto antes de comprar.');
    if (temPix) condicoes.push('A combinação desse cupom com Pix não foi confirmada. Confira o total na loja.');
  }
  const c = o.cupom;
  const cupomValido = c && positivo(c.valor) && ['pct', 'fixo'].includes(c.tipo) && cupomVigente(c, agora);
  if (cupomValido && !o.jaComCupom) {
    const regras = [c.minimo ? `compra mínima de ${reais(c.minimo)}` : null, c.teto ? `desconto máximo de ${reais(c.teto)}` : null,
    c.validade ? `válido até ${dataCurta(new Date(fimValidade(c.validade)).toISOString())}` : null].filter(Boolean).join(', ');
    if (c.minimo && c.minimo > o.preco) {
      condicoes.push(`Cupom de ${nomeCupom(c)}${c.codigo ? ` (${c.codigo})` : ''} só vale em compras a partir de ${reais(c.minimo)}: este produto sozinho não atinge o mínimo.`);
    } else if (c.elegibilidadeConfirmada === true && c.automatico !== 0 && c.automatico !== false && !c.condicoes) {
      const valor = o.preco - descontoCupom(c, o.preco);
      opcoes.push({ valor, rotulo: c.codigo ? `com o cupom ${c.codigo}` : 'com o cupom da loja', tipo: 'cupom' });
      condicoes.push(`Cupom de ${nomeCupom(c)}${c.codigo ? ` (código ${c.codigo})` : ': ative na página do produto'}${regras ? `; ${regras}` : ''}.`);
    } else {
      condicoes.push(`Cupom de ${nomeCupom(c)}${c.codigo ? ` (${c.codigo})` : ''}${regras ? `; ${regras}` : ''}: confira sua elegibilidade e as condições na loja. O desconto não está incluído neste preço.`);
    }
  }
  if (c && !cupomValido && !o.jaComCupom) condicoes.push('Cupom sem validade confirmada: confira as condições atuais na loja.');
  if(c?.condicoes)condicoes.push(typeof c.condicoes==='string'?`Regras adicionais do cupom: ${c.condicoes}.`:'O cupom tem restrições adicionais. Confira os produtos e compradores elegíveis na loja.');
  // Cupom que a loja anuncia para compras acima de um valor maior que o produto: condição, não preço.
  if (o.cupomMinimo && !(c && c.minimo === o.cupomMinimo.minimo)) {
    const cm = o.cupomMinimo;
    condicoes.push(cm.minimo > o.preco
      ? `A loja oferece cupom de ${nomeCupom(cm)} em compras acima de ${reais(cm.minimo)}: só vale completando o carrinho.`
      : `A loja oferece cupom de ${nomeCupom(cm)} em compras acima de ${reais(cm.minimo)}: confira na página do produto.`);
  }
  if (opcoes.some((x) => x.tipo === 'pix') && opcoes.some((x) => x.tipo === 'cupom')) {
    condicoes.push('Pix e cupom foram calculados separadamente: a loja não informa se podem ser somados.');
  }
  for (const t of o.condicoesLoja ?? []) condicoes.push(`Condição da loja: ${t}`);
  opcoes.push({ ...normal, tipo: 'normal' });
  opcoes.sort((a, b) => a.valor - b.valor);
  const [principal, ...alternativas] = opcoes;
  return { principal, alternativas, condicoes };
}

// Atualidade: publicação no grupo, última conferência de preço e se o preço ainda vale como atual.
export function situacao(o, agora = Date.now()) {
  const publicada = Date.parse(o.em);
  const conferido = Date.parse(o.conferido);
  const idadePublicacao = agora - publicada;
  const idadePreco = agora - conferido;
  return {
    recente: Number.isFinite(publicada) && idadePublicacao >= 0 && idadePublicacao < RECENTE_H * HORA,
    precoAtual: Number.isFinite(conferido) && idadePreco >= 0 && idadePreco < VALIDADE_PRECO_H * HORA && !(o.jaComCupom && o.cupom && !cupomVigente(o.cupom,agora)),
    publicada: o.em, conferido: Number.isFinite(conferido) && conferido <= agora ? o.conferido : null,
  };
}
export function haQuanto(iso, agora = Date.now()) {
  if (!Number.isFinite(Date.parse(iso)) || Date.parse(iso) > agora) return 'em data não informada';
  const min = Math.max(1, Math.round((agora - Date.parse(iso)) / 60000));
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return `há ${d} ${d === 1 ? 'dia' : 'dias'}`;
}
export const quandoTexto = (o, agora = Date.now()) => {
  const s = situacao(o, agora);
  if (!s.conferido) return `Publicada ${haQuanto(s.publicada, agora)} · conferência de preço não informada: confira na loja`;
  if (!s.precoAtual) return `Publicada ${haQuanto(s.publicada, agora)} · preço registrado em ${dataHora(s.conferido)}: confira na loja`;
  return Math.abs(Date.parse(s.conferido) - Date.parse(s.publicada)) < 30 * 60000
    ? `Publicada e conferida ${haQuanto(s.publicada, agora)}`
    : `Publicada ${haQuanto(s.publicada, agora)} · preço conferido ${haQuanto(s.conferido, agora)}`;
};

// Categorias por palavras do nome do produto. Conservador: na dúvida, "Outras". Ordem importa (o primeiro que
// casa vence) e cada regra exige uma palavra inteira.
export const CATEGORIAS = {
  tecnologia: 'Tecnologia', casa: 'Casa e cozinha', moda: 'Moda e calçados', beleza: 'Beleza e cuidados', esportes: 'Esportes e fitness', outras: 'Outras',
};
const REGRAS_CATEGORIA = [
  ['esportes', /\b(bicicleta ergometrica|bike spinning|spinning|esteira eletrica|halter(es)?|anilha|whey|creatina|pre[- ]treino|bcaa|colageno|suplemento|academia|yoga|pilates|corda de pular|luva de boxe|bola de futebol|caneleira)\b/],
  ['tecnologia', /\b(smartphone|celular|iphone|galaxy|redmi|xiaomi|motorola|notebook|laptop|tablet|ipad|monitor|smart ?tv|televisao|fone|headset|earbuds?|airpods|caixa de som|soundbar|barra de som|mouse|teclado|ssd|hd externo|pen ?drive|cartao de memoria|carregador|power ?bank|cabo usb|roteador|smartwatch|relogio inteligente|console|playstation|xbox|nintendo|controle|camera|webcam|impressora|projetor|alexa|echo dot|kindle|chromecast|fire tv)\b/],
  ['casa', /\b(air ?fryer|fritadeira|panela|frigideira|cafeteira|liquidificador|batedeira|micro-?ondas|forno|fogao|geladeira|refrigerador|lava e seca|lavadora|maquina de lavar|aspirador|robo aspirador|ventilador|ar[- ]condicionado|purificador|filtro de agua|mop|vassoura|balde|lixeira|cozinha|armario|balcao|guarda[- ]roupa|colchao|travesseiro|lencol|toalha|cortina|tapete|sofa|cadeira|mesa|estante|prateleira|organizador|pote|garrafa termica|copo|talheres|faqueiro|jogo de cama|edredom|ferro de passar|furadeira|parafusadeira|ferramenta|lampada|luminaria|escada)\b/],
  ['beleza', /\b(perfume|desodorante|shampoo|condicionador|creme|hidratante|protetor solar|maquiagem|batom|base liquida|rimel|esmalte|secador|chapinha|prancha alisadora|escova (rotativa|secadora)|barbeador|aparador de pelos|depilador|skincare|serum|sabonete|escova de dentes|creme dental)\b/],
  ['moda', /\b(tenis|sapato|sapatenis|sandalia|chinelo|bota|camiseta|camisa|blusa|calca|bermuda|short|vestido|saia|jaqueta|moletom|casaco|meia|cueca|calcinha|sutia|pijama|bone|mochila|bolsa|carteira|relogio|oculos|cinto|dry[- ]fit|legging)\b/],
];
export function categoriaDoNome(nome) {
  const n = ` ${semAcento(nome).replace(/[^a-z0-9 -]/g, ' ')} `;
  if (/\b(mochila|bolsa|capa para notebook|tenis|sapato|camiseta|camisa|calca|bermuda|legging|short|vestido|sandalia|chinelo)\b/.test(n)) return 'moda';
  return REGRAS_CATEGORIA.find(([, re]) => re.test(n))?.[0] ?? 'outras';
}

// Faixas de preço do filtro. Item sem preço (Amazon) não entra em nenhuma faixa.
export const FAIXAS = { ate50: ['Até R$ 50', 5000], ate100: ['Até R$ 100', 10000], ate300: ['Até R$ 300', 30000] };
export const precoReferencia = (o, agora = Date.now()) => precoComCondicoes(o, agora)?.principal.valor ?? null;

export function filtrarOfertas(ofertas, estado = {}, agora = Date.now()) {
  const palavras = semAcento(estado.q).trim().split(/\s+/).filter(Boolean);
  const limite = FAIXAS[estado.faixa]?.[1];
  const filtradas = ofertas.filter((o) => {
    const preco = precoReferencia(o, agora);
    return (estado.anteriores || o.id === estado.oferta || situacao(o, agora).recente)
      && (!estado.loja || o.loja === estado.loja)
      && (!estado.categoria || (o.categoria ?? categoriaDoNome(o.nome)) === estado.categoria)
      && (!limite || (preco !== null && preco <= limite))
      && palavras.every((p) => semAcento(`${o.nome} ${LOJAS[o.loja] ?? ''}`).includes(p));
  });
  return filtradas.sort((a, b) => {
    if (a.id === estado.oferta) return -1;
    if (b.id === estado.oferta) return 1;
    if (estado.ordem === 'desconto') return desconto(b) - desconto(a) || Date.parse(b.em) - Date.parse(a.em);
    if (estado.ordem === 'menor') return (precoReferencia(a, agora) ?? Infinity) - (precoReferencia(b, agora) ?? Infinity) || Date.parse(b.em) - Date.parse(a.em);
    return Date.parse(b.em) - Date.parse(a.em);
  });
}

// "Escolhas da Diretoria": até 6 ofertas com preço conferido nas últimas 24 h, desconto real sobre o "De",
// no máximo 2 por categoria e sem produtos parecidos entre si. Percentuais acima de 40 não aumentam a prioridade:
// a referência da loja não prova economia histórica. A conferência mais recente também pesa na seleção.
const tokens = (nome) => semAcento(nome).replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((t) => t.length > 2).slice(0, 6);
export function parecidos(a, b) {
  const ta = tokens(a);
  const tb = new Set(tokens(b));
  if (!ta.length || !tb.size) return false;
  if (ta.slice(0, 2).join(' ') === [...tb].slice(0, 2).join(' ')) return true;
  const comum = ta.filter((t) => tb.has(t)).length;
  return comum / Math.max(1, Math.min(ta.length, tb.size)) >= 0.5;
}
export function escolhasDaDiretoria(ofertas, agora = Date.now(), max = 6) {
  const prioridade = o => Math.min(40, desconto(o)) + Math.max(0, 24 - (agora - Date.parse(o.conferido)) / HORA);
  const elegiveis = ofertas.filter((o) => o.loja !== 'amazon' && o.img && desconto(o) >= 20 && situacao(o, agora).precoAtual && situacao(o, agora).recente)
    .sort((a, b) => prioridade(b) - prioridade(a) || Date.parse(b.em) - Date.parse(a.em));
  const escolhidas = [];
  const porCategoria = {};
  for (const o of elegiveis) {
    const cat = o.categoria ?? 'outras';
    if ((porCategoria[cat] ?? 0) >= 2 || escolhidas.some((x) => parecidos(x.nome, o.nome))) continue;
    escolhidas.push(o);
    porCategoria[cat] = (porCategoria[cat] ?? 0) + 1;
    if (escolhidas.length === max) break;
  }
  return escolhidas;
}

// Por que a oferta foi aprovada: só frases sustentadas pelos dados, com a origem (automática ou manual) explícita.
export function motivos(o) {
  const m = [];
  if (o.historico) m.push(`Menor preço que vimos desde ${o.historico}`);
  const d = desconto(o);
  if (d >= 15) m.push(`${d}% abaixo do preço de referência da loja`);
  if (o.criterio) m.push(`Passou nos critérios da busca: ${o.criterio}`);
  if (o.origem === 'manual') m.push('Escolhida manualmente pela Diretoria');
  if (o.origem === 'automatica') m.push('Selecionada pela busca automática');
  return m;
}

// Mensagem para compartilhar: mesma condição de preço do cartão, link direto da loja (Amazon pela página
// intermediária do site) e o convite da Diretoria por último.
export function textoCompartilhar(o, site, agora = Date.now()) {
  const linhas = [o.nome];
  if (o.loja === 'amazon') {
    linhas.push(`Veja o preço na Amazon: ${site}amazon/?asin=${o.asin}`);
  } else {
    const p = precoComCondicoes(o, agora);
    const s = situacao(o, agora);
    if (p && s.precoAtual) {
      linhas.push(`${reais(p.principal.valor)} ${p.principal.rotulo} no ${LOJAS[o.loja]}`);
      linhas.push(...p.condicoes);
    } else if (p) {
      linhas.push(`Preço registrado: ${reais(p.principal.valor)} ${p.principal.rotulo}${s.conferido ? ` em ${dataHora(s.conferido)}` : ''} no ${LOJAS[o.loja]}: confira o preço atual na loja.`);
    } else {
      linhas.push(`Confira o preço no ${LOJAS[o.loja]}.`);
    }
    linhas.push(o.link);
  }
  linhas.push('', `Mais ofertas aprovadas pela Diretoria: ${site}`);
  return linhas.join('\n');
}
