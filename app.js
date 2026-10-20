// Dados públicos entram como texto; as regras de preço também são usadas pelo exportador e pelos testes.
import { LOJAS, CATEGORIAS, FAIXAS, reais, semAcento, desconto, linkLoja, precoComCondicoes, situacao,
  quandoTexto, haQuanto, escolhasDaDiretoria, motivos, textoCompartilhar, filtrarOfertas, cupomVigente, fimValidade, categoriaDoNome } from './regras.js?v=20261020e';
export const DECLARACAO_AMAZON = 'Como participante do Programa de Associados da Amazon, sou remunerado pelas compras qualificadas efetuadas.';
const SITE = 'https://adiretoria.github.io/';
const POR_PAGINA = 24;
const $ = id => document.getElementById(id);
const CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 13.5l3.6-3.2 4.3 4.9L18.6 3 22.4 6 10.2 21z" fill="currentColor"/></svg>';
const LOGOS = {mercadolivre:'img/lojas/mercadolivre.svg',shopee:'img/lojas/shopee.svg',magalu:'img/lojas/magalu.svg'};
const padrao = {aba:'ofertas',q:'',loja:'',categoria:'',faixa:'',anteriores:false,ordem:'recentes',limite:POR_PAGINA,oferta:null};
let estado = {...padrao};
let dados = {ofertas:[],cupons:[],grupos:{}};
let timer, observer, carregando=false, assinatura='';

function linhaLoja(el, loja) {
  el.replaceChildren('No ',Object.assign(document.createElement('strong'),{textContent:LOJAS[loja]}));
  el.insertAdjacentHTML('beforeend',CHECK); // SVG constante, sem conteúdo do banco.
}
function lerUrl() {
  const p=new URLSearchParams(location.search);
  estado={...padrao,q:(p.get('q')??'').slice(0,200),loja:Object.hasOwn(LOJAS,p.get('loja'))?p.get('loja'):'',
    categoria:Object.hasOwn(CATEGORIAS,p.get('categoria'))?p.get('categoria'):'',faixa:Object.hasOwn(FAIXAS,p.get('faixa'))?p.get('faixa'):'',
    anteriores:p.get('anteriores')==='1',ordem:['recentes','desconto','menor'].includes(p.get('ordem'))?p.get('ordem'):'recentes',
    oferta:/^\d{1,9}$/.test(p.get('oferta')??'')?Number(p.get('oferta')):null,aba:p.get('ver')==='cupons'?'cupons':'ofertas'};
}
function gravarUrl() {
  const p=new URLSearchParams();
  for (const k of ['q','loja','categoria','faixa','oferta']) if(estado[k]) p.set(k,estado[k]);
  if(estado.anteriores)p.set('anteriores','1');
  if(estado.ordem!=='recentes')p.set('ordem',estado.ordem);
  if(estado.aba==='cupons')p.set('ver','cupons');
  history.replaceState(null,'',`${location.pathname}${p.size?`?${p}`:''}`);
}
function atualizar(mudancas={}) {
  clearTimeout(timer);
  estado={...estado,q:$('busca').value.trim(),oferta:null,limite:POR_PAGINA,...mudancas};
  render();
}
const buscaCasa = texto => semAcento(estado.q).split(/\s+/).filter(Boolean).every(p=>semAcento(texto).includes(p));
const cuponsValidos = agora => dados.cupons.filter(c=>cupomVigente(c,agora));
const filtrarCupons = agora => cuponsValidos(agora).filter(c=>(!estado.loja||c.loja===estado.loja)&&buscaCasa(`${c.titulo} ${c.detalhe??''} ${LOJAS[c.loja]}`));
function ligarCompartilhar(el,o,agora) {
  const a=el.querySelector('.compartilhar');
  a.href=`https://wa.me/?text=${encodeURIComponent(textoCompartilhar(o,SITE,agora))}`;
  a.setAttribute('aria-label',`Compartilhar ${o.nome} no WhatsApp`);
  if(o.id===estado.oferta)el.classList.add('compartilhada');
}
function imagem(el,src) {
  const img=el.querySelector('img'),box=img.parentElement;
  const falhou=()=>{box.classList.add('sem-foto');img.remove();};
  if(!src){falhou();return;}
  img.addEventListener('error',falhou,{once:true});img.src=src;
}
function cartaoAmazon(o,agora) {
  const el=$('modelo-amazon').content.firstElementChild.cloneNode(true);
  el.querySelector('.oferta-link').href=o.link;
  el.querySelector('.oferta-link').setAttribute('aria-label',`${o.nome}: ver preço na Amazon`);
  el.querySelector('.nome').textContent=o.nome;
  el.querySelector('.quando').textContent=`Publicada ${haQuanto(o.em,agora)}`;
  el.querySelector('.declaracao').textContent=DECLARACAO_AMAZON;
  ligarCompartilhar(el,o,agora);return el;
}
function cartaoOferta(o,agora) {
  if(o.loja==='amazon')return cartaoAmazon(o,agora);
  const el=$('modelo-oferta').content.firstElementChild.cloneNode(true);
  const p=precoComCondicoes(o,agora),s=situacao(o,agora),pct=desconto(o),a=el.querySelector('.oferta-link');
  a.href=o.link;
  a.setAttribute('aria-label',`${o.nome}, ${s.precoAtual?'':'preço registrado: '}${reais(p.principal.valor)} ${p.principal.rotulo} no ${LOJAS[o.loja]}. ${s.precoAtual?'':'Confira o preço atual na loja.'}`);
  imagem(el,o.img);
  if(pct>=5&&s.precoAtual)el.querySelector('.carimbo-pct').textContent=`−${pct}%`;
  else el.querySelector('.carimbo').hidden=true;
  linhaLoja(el.querySelector('.loja'),o.loja);
  el.querySelector('.nome').textContent=o.nome;
  el.querySelector('.selo').textContent=CATEGORIAS[o.categoria]??'Outras';
  el.querySelector('.preco-status').textContent=s.precoAtual?'':'Preço registrado · confira na loja';
  if(o.de>o.preco)el.querySelector('.de').textContent=`Referência da loja: ${reais(o.de)}`;
  el.querySelector('.por').textContent=reais(p.principal.valor);
  el.querySelector('.preco-condicao').textContent=p.principal.rotulo;
  el.querySelector('.alternativas').textContent=p.alternativas.map(x=>`${reais(x.valor)} ${x.rotulo}`).join(' · ');
  el.querySelector('.cupom-aviso').textContent=p.condicoes.find(t=>/sozinho|completando o carrinho/.test(t)) ?? '';
  el.querySelector('.quando').textContent=quandoTexto(o,agora);
  if(!s.precoAtual)el.querySelector('.quando').classList.add('antiga');
  const razoes=[...p.condicoes,...motivos(o)];
  if(!o.origem)razoes.push('Origem da seleção não informada.');
  if(pct)razoes.push('A referência é informada pela loja; não é uma comparação de todo o mercado.');
  el.querySelector('.condicoes ul').replaceChildren(...razoes.map(t=>Object.assign(document.createElement('li'),{textContent:t})));
  ligarCompartilhar(el,o,agora);return el;
}
function cartaoCupom(c) {
  const el=$('modelo-cupom').content.firstElementChild.cloneNode(true);
  el.querySelector('.cupom-valor').textContent=c.tipo==='pct'?`${c.valor}%`:c.tipo==='fixo'?reais(Math.round(c.valor*100)):'Cupom';
  linhaLoja(el.querySelector('.loja'),c.loja);el.querySelector('.cupom-titulo').textContent=c.titulo;
  el.querySelector('.cupom-regras').textContent=[c.detalhe,c.minimo?`Compra mínima ${reais(c.minimo)}`:null,c.teto?`Desconto máximo ${reais(c.teto)}`:null,
    c.validade?`Válido até ${new Date(fimValidade(c.validade)).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'})}`:'Validade não informada',
    'Confira os produtos elegíveis e as condições na loja.'].filter(Boolean).join(' · ');
  el.querySelector('.cupom-link').href=c.link;
  el.querySelector('.cupom-link').setAttribute('aria-label',`Ver cupom ${c.titulo} no ${LOJAS[c.loja]}`);return el;
}
function chipsLojas(agora) {
  const base=estado.aba==='cupons'?cuponsValidos(agora):filtrarOfertas(dados.ofertas,{anteriores:estado.anteriores,oferta:estado.oferta},agora);
  const conta=l=>base.filter(o=>!l||o.loja===l).length;
  $('chips-lojas').replaceChildren(...[['','Todas'],...Object.entries(LOJAS)].map(([loja,nome])=>{
    const b=document.createElement('button');
    b.type='button';b.className=`chip chip-${loja||'todas'}`;b.dataset.foco=`loja-${loja}`;
    b.setAttribute('aria-pressed',String(estado.loja===loja));
    b.setAttribute('aria-label',`${nome}: ${conta(loja)} ${estado.aba==='cupons'?'cupons':'ofertas'}`);
    if(LOGOS[loja])b.append(Object.assign(document.createElement('img'),{src:LOGOS[loja],alt:'',className:'chip-logo'}));
    b.append(nome,Object.assign(document.createElement('small'),{textContent:conta(loja)}));
    b.addEventListener('click',()=>atualizar({loja}));return b;
  }));
}
function filtrosAtivos() {
  const filtros=[['q',estado.q?`Busca: ${estado.q}`:''],['loja',LOJAS[estado.loja]],
    ...(estado.aba==='ofertas'?[['categoria',CATEGORIAS[estado.categoria]],['faixa',FAIXAS[estado.faixa]?.[0]],['anteriores',estado.anteriores?'Incluindo anteriores':'']]:[])];
  $('filtros-ativos').replaceChildren(...filtros.filter(([,t])=>t).map(([k,t])=>{
    const b=Object.assign(document.createElement('button'),{type:'button',className:'filtro-ativo',textContent:`${t} ×`});
    b.setAttribute('aria-label',`Remover filtro ${t}`);
    b.addEventListener('click',()=>{if(k==='q')$('busca').value='';atualizar({[k]:k==='anteriores'?false:''});$('busca').focus();});return b;
  }));
  $('limpar').hidden=!filtros.some(([,t])=>t)&&estado.ordem==='recentes';
}
function faixaDestaques(agora) {
  const mostrar=estado.aba==='ofertas'&&!estado.q&&!estado.loja&&!estado.categoria&&!estado.faixa&&!estado.anteriores&&!estado.oferta;
  const lista=mostrar?escolhasDaDiretoria(dados.ofertas,agora):[];
  $('destaques').hidden=!lista.length;
  $('lista-destaques').replaceChildren(...lista.map(o=>{
    const el=$('modelo-destaque').content.firstElementChild.cloneNode(true),p=precoComCondicoes(o,agora).principal;
    el.querySelector('a').href=o.link;
    el.querySelector('a').setAttribute('aria-label',`${o.nome}, ${reais(p.valor)} ${p.rotulo} no ${LOJAS[o.loja]}`);
    imagem(el,o.img);el.querySelector('.destaque-pct').textContent=`−${desconto(o)}%`;
    el.querySelector('.destaque-nome').textContent=o.nome;el.querySelector('.destaque-preco').textContent=reais(p.valor);
    el.querySelector('.destaque-condicao').textContent=p.rotulo;return el;
  }));
}
function render() {
  const agora=Date.now(),cupons=estado.aba==='cupons',foco=document.activeElement?.dataset.foco;
  for(const aba of ['ofertas','cupons']) {
    $(`aba-${aba}`).setAttribute('aria-selected',String(estado.aba===aba));
    $(`aba-${aba}`).tabIndex=estado.aba===aba?0:-1;$(`painel-${aba}`).hidden=estado.aba!==aba;
  }
  for(const id of ['campo-categoria','campo-faixa','campo-ordem','campo-anteriores'])$(id).hidden=cupons;
  $('busca').value=estado.q;$('categoria').value=estado.categoria;$('faixa').value=estado.faixa;$('anteriores').checked=estado.anteriores;
  chipsLojas(agora);filtrosAtivos();faixaDestaques(agora);
  for(const b of $('ordens').children)b.setAttribute('aria-pressed',String(b.dataset.ordem===estado.ordem));
  const lista=cupons?filtrarCupons(agora):filtrarOfertas(dados.ofertas,estado,agora);
  if(cupons) {
    $('lista-cupons').replaceChildren(...lista.map(cartaoCupom));$('vazio-cupons').hidden=!!lista.length;
    $('vazio-cupons').textContent='Nenhum cupom com esses filtros e validade em aberto. Limpe os filtros ou tente outra busca.';
  } else {
    $('lista-ofertas').replaceChildren(...lista.slice(0,estado.limite).map(o=>cartaoOferta(o,agora)));$('vazio-ofertas').hidden=!!lista.length;
    $('vazio-ofertas').textContent='Nenhuma oferta com esses filtros. Limpe os filtros ou inclua ofertas anteriores.';
    $('mais-ofertas').hidden=lista.length<=estado.limite;
  }
  $('contagem').textContent=`${lista.length} ${cupons?(lista.length===1?'cupom encontrado':'cupons encontrados'):(lista.length===1?'oferta encontrada':'ofertas encontradas')}${cupons?' · validade informada pela loja':estado.anteriores?' · incluindo publicações anteriores':' · publicadas nas últimas 48 h'}.`;
  if(estado.oferta&&dados.ofertas.some(o=>o.id===estado.oferta&&!situacao(o,agora).recente))$('contagem').textContent+=' Inclui a oferta antiga compartilhada.';
  if(estado.oferta&&!dados.ofertas.some(o=>o.id===estado.oferta))$('contagem').textContent='A oferta compartilhada saiu da pauta. Veja as outras ofertas ou busque um produto.';
  gravarUrl();
  if(foco)document.querySelector(`[data-foco="${foco}"]`)?.focus({preventScroll:true});
  assinatura=assinaturaAtual(agora);
}
function assinaturaAtual(agora=Date.now()) {
  return JSON.stringify([cuponsValidos(agora).map(c=>c.id),dados.ofertas.map(o=>[situacao(o,agora).precoAtual,situacao(o,agora).recente])]);
}
function ligarControles() {
  for(const [k,nome] of Object.entries(CATEGORIAS))$('categoria').add(new Option(nome,k));
  for(const [k,[nome]] of Object.entries(FAIXAS))$('faixa').add(new Option(nome,k));
  $('busca').addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(()=>atualizar(),180);});
  $('filtros').addEventListener('submit',e=>{e.preventDefault();atualizar();});
  for(const k of ['categoria','faixa'])$(k).addEventListener('change',()=>atualizar({[k]:$(k).value}));
  $('anteriores').addEventListener('change',()=>atualizar({anteriores:$('anteriores').checked}));
  for(const b of $('ordens').children)b.addEventListener('click',()=>atualizar({ordem:b.dataset.ordem}));
  $('limpar').addEventListener('click',()=>{clearTimeout(timer);estado={...padrao,aba:estado.aba};render();$('busca').focus();});
  $('mais-ofertas').addEventListener('click',()=>{const novo=$('lista-ofertas').children.length;estado.limite+=POR_PAGINA;render();$('lista-ofertas').children[novo]?.querySelector('.oferta-link').focus();});
  const trocar=aba=>{atualizar({aba});$(`aba-${aba}`).focus();};
  for(const aba of ['ofertas','cupons'])$(`aba-${aba}`).addEventListener('click',()=>trocar(aba));
  document.querySelector('.abas').addEventListener('keydown',e=>{
    if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();trocar(e.key==='Home'?'ofertas':e.key==='End'?'cupons':estado.aba==='ofertas'?'cupons':'ofertas');}
  });
  $('tentar').addEventListener('click',carregar);
  window.addEventListener('popstate',()=>{clearTimeout(timer);lerUrl();render();});
  setInterval(()=>{if(!document.hidden&&assinatura!==assinaturaAtual())render();},30000);
}
async function carregar() {
  if(carregando)return;
  carregando=true;$('erro').hidden=true;$('tentar').disabled=true;$('resumo').textContent='Carregando as ofertas aprovadas…';
  try {
    const resposta=await fetch('dados/ofertas.json',{cache:'no-cache'});
    if(!resposta.ok)throw new Error('Dados indisponíveis');
    const j=await resposta.json();
    if(!Array.isArray(j.ofertas)||!Array.isArray(j.cupons))throw new Error('Formato inválido');
    const ofertas=j.ofertas.filter(o=>Object.hasOwn(LOJAS,o.loja)&&typeof o.nome==='string'&&linkLoja(o.link,o.loja)&&
      (o.loja==='amazon'?/^[A-Z0-9]{10}$/.test(o.asin):Number.isFinite(o.preco)&&o.preco>0)).map(o=>({...o,
        img:/^https:\/\/[^\s"'<>()]+$/.test(o.img??'')?o.img:null,categoria:Object.hasOwn(CATEGORIAS,o.categoria)?o.categoria:categoriaDoNome(o.nome)}));
    const cupons=j.cupons.filter(c=>c.loja!=='amazon'&&Object.hasOwn(LOJAS,c.loja)&&linkLoja(c.link,c.loja));
    dados={ofertas,cupons,grupos:j.grupos??{}};
    for(const canal of ['whatsapp','telegram']) {
      let url;try{url=new URL(dados.grupos[canal]);}catch{}
      const hosts=canal==='whatsapp'?['chat.whatsapp.com','whatsapp.com']:['t.me'];
      const valida=url&&url.protocol==='https:'&&!url.port&&!url.username&&!url.password&&hosts.includes(url.hostname);
      for(const id of [`grupo-${canal}`,`barra-${canal}`]){$(id).hidden=!valida;if(valida)$(id).href=url.href;}
    }
    observer?.disconnect();
    if('IntersectionObserver' in window&&(!$('grupo-whatsapp').hidden||!$('grupo-telegram').hidden)) {
      observer=new IntersectionObserver(([e])=>{$('barra-grupos').hidden=e.isIntersecting;});observer.observe(document.querySelector('.grupos'));
    }
    $('declaracao-amazon').textContent=j.amazon?DECLARACAO_AMAZON:'';
    $('atualizado').textContent=Number.isFinite(Date.parse(j.geradoEm))?`Lista atualizada em ${new Date(j.geradoEm).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'})}. Cada preço tem sua própria data de conferência.`:'';
    $('resumo').textContent='Encontre a oferta, confira as condições e vá direto à loja.';render();
    if(estado.oferta)document.querySelector('.compartilhada')?.scrollIntoView({block:'center'});
  } catch {
    $('erro').hidden=false;$('resumo').textContent='As ofertas estão indisponíveis no momento.';
  } finally {carregando=false;$('tentar').disabled=false;}
}
lerUrl();ligarControles();carregar();
