// Vitrine estática: lê dados/ofertas.json (gerado pelo exportador a partir das publicações dos grupos),
// busca, filtra por loja e ordena no navegador. Textos dos dados entram só via textContent.
const LOJAS = { mercadolivre: 'Mercado Livre', amazon: 'Amazon', shopee: 'Shopee', magalu: 'Magalu' };
// "No Mercado Livre ✓": onde a oferta está (não "vendido por": em marketplace quem vende pode ser um lojista).
const CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 13.5l3.6-3.2 4.3 4.9L18.6 3 22.4 6 10.2 21z" fill="currentColor"/></svg>';
const LOGOS = { mercadolivre: 'img/lojas/mercadolivre.svg', shopee: 'img/lojas/shopee.svg', magalu: 'img/lojas/magalu.svg' };
function linhaLoja(el, loja) {
  el.replaceChildren('No ', Object.assign(document.createElement('strong'), { textContent: LOJAS[loja] }));
  el.insertAdjacentHTML('beforeend', CHECK);
  el.dataset.loja = loja;
}
const POR_PAGINA = 24;
const $ = (id) => document.getElementById(id);
const reais = (c) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const semAcento = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const desconto = (o) => (o.de && o.preco ? Math.round((1 - o.preco / o.de) * 100) : 0);
// Frase exigida pelo Contrato Operacional do Programa de Associados Amazon.com.br (cláusula 5).
export const DECLARACAO_AMAZON = 'Como participante do Programa de Associados da Amazon, sou remunerado pelas compras qualificadas efetuadas.';
// Defesa extra: só https das lojas, mesmo que o arquivo de dados venha alterado.
const HOSTS = ['amazon.com.br', 'amzn.to', 'shopee.com.br', 'shope.ee', 'mercadolivre.com.br', 'meli.la', 'magazinevoce.com.br', 'magazineluiza.com.br'];
const linkLoja = (u) => { const x = URL.parse(String(u ?? '')); return x && x.protocol === 'https:' && HOSTS.some((h) => x.hostname === h || x.hostname.endsWith(`.${h}`)) ? x.href : null; };

function quando(iso) {
  const min = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (min < 60) return `Aprovada há ${min || 1} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `Aprovada há ${h} h`;
  const dias = Math.round(h / 24);
  return `Aprovada há ${dias} ${dias === 1 ? 'dia' : 'dias'} · o preço pode ter mudado`;
}

const estado = { aba: 'ofertas', q: '', loja: '', ordem: 'recentes', limite: POR_PAGINA, oferta: null };
const SITE = 'https://adiretoria.github.io/';
let dados = { ofertas: [], cupons: [], grupos: {} };

// Estado na URL: dá para compartilhar uma busca ("?q=fone&loja=amazon").
function lerUrl() {
  const p = new URLSearchParams(location.search);
  estado.q = p.get('q') ?? '';
  estado.loja = LOJAS[p.get('loja')] ? p.get('loja') : '';
  estado.ordem = ['recentes', 'desconto', 'menor'].includes(p.get('ordem')) ? p.get('ordem') : 'recentes';
  estado.oferta = /^\d{1,9}$/.test(p.get('oferta') ?? '') ? Number(p.get('oferta')) : null;
  estado.aba = p.get('ver') === 'cupons' ? 'cupons' : 'ofertas';
}
function gravarUrl() {
  const p = new URLSearchParams();
  if (estado.q) p.set('q', estado.q);
  if (estado.loja) p.set('loja', estado.loja);
  if (estado.ordem !== 'recentes') p.set('ordem', estado.ordem);
  if (estado.aba === 'cupons') p.set('ver', 'cupons');
  if (estado.oferta) p.set('oferta', estado.oferta);
  history.replaceState(null, '', `${location.pathname}${p.size ? `?${p}` : ''}`);
}

const casa = (texto) => semAcento(estado.q).split(/\s+/).filter(Boolean).every((t) => semAcento(texto).includes(t));
const filtrarOfertas = () => {
  const lista = dados.ofertas.filter((o) => (!estado.loja || o.loja === estado.loja) && casa(`${o.nome} ${LOJAS[o.loja]}`));
  // Amazon não tem preço no site (só a loja pode exibir): vai para o fim quando a ordem é por preço.
  const p = (o, semPreco) => o.preco ?? semPreco;
  const ordem = { desconto: (a, b) => desconto(b) - desconto(a), menor: (a, b) => p(a, Infinity) - p(b, Infinity) }[estado.ordem];
  if (ordem) lista.sort(ordem);
  // Oferta compartilhada (?oferta=ID) vai para o topo da lista.
  const i = lista.findIndex((o) => o.id === estado.oferta);
  if (i > 0) lista.unshift(...lista.splice(i, 1));
  return lista;
};
const filtrarCupons = () => dados.cupons.filter((c) => (!estado.loja || c.loja === estado.loja) && casa(`${c.titulo} ${c.detalhe ?? ''} ${LOJAS[c.loja]}`));

// Compartilhar no WhatsApp: leva para a oferta no nosso site (nunca o link da loja direto, e sem preço da Amazon).
function ligarCompartilhar(el, o) {
  const preco = o.loja !== 'amazon' && o.preco ? ` por ${reais(o.preco)}` : '';
  const texto = `${o.nome}${preco} — aprovado pela Diretoria ✅\n${SITE}?oferta=${o.id}`;
  const a = el.querySelector('.compartilhar');
  a.href = `https://wa.me/?text=${encodeURIComponent(texto)}`;
  a.setAttribute('aria-label', `Compartilhar ${o.nome} no WhatsApp`);
  if (o.id === estado.oferta) el.classList.add('compartilhada');
}

// Amazon: só nome e link direto com a tag. Preço, imagem e selos só poderiam vir da API da Amazon.
function cartaoAmazon(o) {
  const el = $('modelo-amazon').content.firstElementChild.cloneNode(true);
  const a = el.querySelector('.oferta-link');
  a.href = o.link;
  a.setAttribute('aria-label', `${o.nome}: ver preço na Amazon`);
  el.querySelector('.nome').textContent = o.nome;
  el.querySelector('.quando').textContent = quando(o.em).replace(' · o preço pode ter mudado', '');
  el.querySelector('.declaracao').textContent = DECLARACAO_AMAZON;
  ligarCompartilhar(el, o);
  return el;
}

function cartaoOferta(o) {
  if (o.loja === 'amazon') return cartaoAmazon(o);
  const el = $('modelo-oferta').content.firstElementChild.cloneNode(true);
  const a = el.querySelector('.oferta-link');
  a.href = o.link;
  a.setAttribute('aria-label', `${o.nome}, ${reais(o.preco)} na ${LOJAS[o.loja]}`);
  const img = el.querySelector('img');
  if (o.img) img.src = o.img;
  else img.parentElement.classList.add('sem-foto'), img.remove();
  img.addEventListener('error', () => { img.parentElement.classList.add('sem-foto'); img.remove(); });
  const pct = desconto(o);
  if (pct >= 5) el.querySelector('.carimbo-pct').textContent = `−${pct}%`;
  else el.querySelector('.carimbo').hidden = true;
  linhaLoja(el.querySelector('.loja'), o.loja);
  el.querySelector('.nome').textContent = o.nome;
  el.querySelector('.selo').textContent = [o.selo, o.cupom].filter(Boolean).join(' · ');
  if (o.de) el.querySelector('.de').textContent = reais(o.de);
  el.querySelector('.por').textContent = reais(o.preco);
  if (o.pix) el.querySelector('.pix').textContent = `${reais(o.pix)} no Pix`;
  const q = el.querySelector('.quando');
  q.textContent = quando(o.em);
  if (Date.now() - Date.parse(o.em) > 86400000) q.classList.add('antiga');
  ligarCompartilhar(el, o);
  return el;
}

function cartaoCupom(c) {
  const el = $('modelo-cupom').content.firstElementChild.cloneNode(true);
  const v = el.querySelector('.cupom-valor');
  if (c.valor && c.tipo === 'pct') v.textContent = `${c.valor}%`;
  else if (c.valor && c.tipo === 'fixo') v.textContent = `R$${Number.isInteger(c.valor) ? c.valor : c.valor.toFixed(2).replace('.', ',')}`;
  else v.textContent = 'Cupom';
  if (c.valor) { const s = document.createElement('small'); s.textContent = 'de desconto'; v.append(s); }
  linhaLoja(el.querySelector('.loja'), c.loja);
  el.querySelector('.cupom-titulo').textContent = c.titulo;
  const regras = [c.detalhe, c.minimo ? `Compra mínima ${reais(c.minimo)}` : null, c.teto ? `limite de ${reais(c.teto)}` : null,
    c.validade ? `válido até ${new Date(c.validade).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}` : null].filter(Boolean);
  el.querySelector('.cupom-regras').textContent = regras.join(' · ');
  const a = el.querySelector('.cupom-link');
  a.href = c.link;
  a.setAttribute('aria-label', `Usar cupom ${c.titulo} na ${LOJAS[c.loja]}`);
  return el;
}

// Blocos das lojas parceiras (nas cores de cada loja): mostram quantas ofertas há e filtram ao tocar.
function blocosParceiras() {
  const base = estado.aba === 'cupons' ? dados.cupons : dados.ofertas;
  const ordem = ['mercadolivre', 'shopee', 'magalu', 'amazon'];
  $('parceiras').replaceChildren(...ordem.filter((l) => base.some((x) => x.loja === l) || dados.ofertas.some((x) => x.loja === l)).map((l) => {
    const n = base.filter((x) => x.loja === l).length;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `parceira parceira-${l}`;
    b.setAttribute('aria-pressed', String(estado.loja === l));
    b.setAttribute('aria-label', `${LOJAS[l]}: ${n} ${estado.aba === 'cupons' ? 'cupons' : 'ofertas'}${estado.loja === l ? ', filtro ativo' : ''}`);
    // Logo da loja (Shopee e Magalu em branco sobre a cor delas); Amazon só com o nome, pelas regras de marca dela.
    const nome = LOGOS[l] ? Object.assign(document.createElement('img'), { src: LOGOS[l], alt: '', className: 'parceira-logo' })
      : Object.assign(document.createElement('span'), { className: 'parceira-nome', textContent: LOJAS[l] });
    const qt = document.createElement('span');
    qt.className = 'parceira-qt';
    // "até X% OFF": maior desconto real entre as ofertas da loja (Amazon não tem preço no site, então não tem).
    const maxPct = estado.aba === 'cupons' ? 0 : Math.max(0, ...base.filter((x) => x.loja === l).map(desconto));
    const contagem = `${n} ${estado.aba === 'cupons' ? (n === 1 ? 'cupom' : 'cupons') : (n === 1 ? 'oferta' : 'ofertas')}`;
    qt.replaceChildren(...(maxPct >= 10 ? [Object.assign(document.createElement('b'), { textContent: `até ${maxPct}% OFF` }), ' '] : []), contagem);
    b.append(nome, qt);
    b.addEventListener('click', () => {
      estado.loja = estado.loja === l ? '' : l;
      estado.limite = POR_PAGINA;
      render();
      $(estado.aba === 'cupons' ? 'painel-cupons' : 'painel-ofertas').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    });
    return b;
  }));
}

// Faixa "Maiores descontos de hoje": as 10 ofertas das últimas 24 h com mais desconto (só sem busca/filtro).
function faixaDestaques() {
  const mostrar = estado.aba === 'ofertas' && !estado.q && !estado.loja;
  const lista = dados.ofertas.filter((o) => o.loja !== 'amazon' && desconto(o) >= 20 && Date.now() - Date.parse(o.em) < 86400000)
    .sort((a, b) => desconto(b) - desconto(a)).slice(0, 10);
  $('destaques').hidden = !mostrar || lista.length < 3;
  if ($('destaques').hidden) return;
  $('lista-destaques').replaceChildren(...lista.map((o) => {
    const el = $('modelo-destaque').content.firstElementChild.cloneNode(true);
    const a = el.querySelector('a');
    a.href = o.link;
    a.setAttribute('aria-label', `${o.nome}, ${desconto(o)}% de desconto, ${reais(o.preco)} na ${LOJAS[o.loja]}`);
    const img = el.querySelector('img');
    if (o.img) img.src = o.img; else img.remove();
    el.querySelector('.destaque-pct').textContent = `−${desconto(o)}%`;
    el.querySelector('.destaque-nome').textContent = o.nome;
    el.querySelector('.destaque-preco').textContent = reais(o.preco);
    return el;
  }));
}

function chipsLojas() {
  const base = estado.aba === 'cupons' ? dados.cupons : dados.ofertas;
  const conta = (l) => base.filter((x) => !l || x.loja === l).length;
  const box = $('chips-lojas');
  box.replaceChildren(...[['', 'Todas'], ...Object.entries(LOJAS)].filter(([l]) => !l || conta(l)).map(([l, nome]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.setAttribute('aria-pressed', String(estado.loja === l));
    b.textContent = nome;
    const s = document.createElement('small');
    s.textContent = conta(l);
    b.append(s);
    b.addEventListener('click', () => { estado.loja = l; estado.limite = POR_PAGINA; render(); });
    return b;
  }));
}

function render() {
  const cupons = estado.aba === 'cupons';
  $('aba-ofertas').setAttribute('aria-selected', String(!cupons));
  $('aba-cupons').setAttribute('aria-selected', String(cupons));
  $('aba-ofertas').tabIndex = cupons ? -1 : 0;
  $('aba-cupons').tabIndex = cupons ? 0 : -1;
  $('painel-ofertas').hidden = cupons;
  $('painel-cupons').hidden = !cupons;
  $('campo-ordem').hidden = cupons;
  chipsLojas();
  blocosParceiras();
  faixaDestaques();
  for (const b of $('ordens').children) b.setAttribute('aria-pressed', String(b.dataset.ordem === estado.ordem));
  const filtro = estado.q || estado.loja ? ' Limpe a busca ou escolha outra loja.' : '';
  if (cupons) {
    const lista = filtrarCupons();
    $('lista-cupons').replaceChildren(...lista.map(cartaoCupom));
    $('vazio-cupons').hidden = !!lista.length;
    $('vazio-cupons').textContent = `Nenhum cupom válido com esse filtro.${filtro}`;
    $('resumo').textContent = `${lista.length} ${lista.length === 1 ? 'cupom válido publicado' : 'cupons válidos publicados'} nos grupos.`;
  } else {
    const lista = filtrarOfertas();
    $('lista-ofertas').replaceChildren(...lista.slice(0, estado.limite).map(cartaoOferta));
    $('vazio-ofertas').hidden = !!lista.length;
    $('vazio-ofertas').textContent = `Nenhuma oferta com esse filtro.${filtro}`;
    $('mais-ofertas').hidden = lista.length <= estado.limite;
    const hoje = dados.ofertas.filter((o) => Date.now() - Date.parse(o.em) < 86400000).length;
    const procurada = estado.oferta && !dados.ofertas.some((o) => o.id === estado.oferta);
    $('resumo').textContent = procurada ? 'A oferta compartilhada já saiu da pauta (fica 7 dias). Veja as aprovadas agora.'
      : estado.q || estado.loja
      ? `${lista.length} ${lista.length === 1 ? 'oferta encontrada' : 'ofertas encontradas'} entre as aprovadas na última semana.`
      : `${hoje} ofertas aprovadas nas últimas 24 horas, ${dados.ofertas.length} na semana. Toque na oferta para ir à loja.`;
  }
  gravarUrl();
}

function ligarAbas() {
  const trocar = (aba) => { estado.aba = aba; estado.loja = ''; estado.limite = POR_PAGINA; render(); $(`aba-${aba}`).focus(); };
  $('aba-ofertas').addEventListener('click', () => trocar('ofertas'));
  $('aba-cupons').addEventListener('click', () => trocar('cupons'));
  document.querySelector('.abas').addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') trocar(estado.aba === 'ofertas' ? 'cupons' : 'ofertas');
  });
}

async function iniciar() {
  lerUrl();
  $('data-ata').textContent = `Ata da reunião · ${new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: 'numeric', month: 'long' })}`;
  $('busca').value = estado.q;

  let t;
  $('busca').addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { estado.q = $('busca').value.trim(); estado.limite = POR_PAGINA; render(); }, 180); });
  for (const b of $('ordens').children) b.addEventListener('click', () => { estado.ordem = b.dataset.ordem; estado.limite = POR_PAGINA; render(); });
  $('filtros').addEventListener('submit', (e) => e.preventDefault());
  $('mais-ofertas').addEventListener('click', () => { estado.limite += POR_PAGINA; render(); });
  ligarAbas();
  try {
    const r = await fetch('dados/ofertas.json', { cache: 'no-cache' });
    if (!r.ok) throw new Error(r.status);
    const j = await r.json();
    dados = {
      grupos: j.grupos ?? {},
      ofertas: (j.ofertas ?? []).filter((o) => LOJAS[o.loja] && linkLoja(o.link) && (o.preco > 0 || (o.loja === 'amazon' && /^https:\/\/www\.amazon\.com\.br\/dp\//.test(o.link)))).map((o) => ({ ...o, link: linkLoja(o.link), img: /^https:\/\//.test(o.img ?? '') ? o.img : null })),
      cupons: (j.cupons ?? []).filter((c) => LOJAS[c.loja] && linkLoja(c.link)),
    };
    for (const [canal, url] of Object.entries(dados.grupos)) {
      const a = $(`grupo-${canal}`);
      if (a && /^https:\/\/(chat\.whatsapp\.com|whatsapp\.com|t\.me)\//.test(url)) {
        for (const x of [a, $(`barra-${canal}`)]) { x.href = url; x.hidden = false; }
      }
    }
    // Celular: quando os botões do topo saem da tela, aparece a barra fixa "Entrar no grupo".
    const topo = document.querySelector('.grupos');
    if (Object.keys(dados.grupos).length && 'IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => { $('barra-grupos').hidden = e.isIntersecting; }).observe(topo);
    }
    if (j.amazon) $('declaracao-amazon').textContent = DECLARACAO_AMAZON;
    if (j.geradoEm) $('atualizado').textContent = `Lista atualizada em ${new Date(j.geradoEm).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })}.`;
    render();
    if (estado.oferta) document.querySelector('.compartilhada')?.scrollIntoView({ block: 'center' });
  } catch {
    $('resumo').textContent = 'Não foi possível carregar as ofertas agora. Recarregue a página em alguns instantes.';
  }
}
iniciar();
