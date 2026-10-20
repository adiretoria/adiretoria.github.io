import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../regras.js';

const agora=Date.parse('2026-10-20T04:00:00Z');
const oferta=(extra={})=>({id:1,nome:'Panela elétrica',loja:'mercadolivre',preco:10000,de:15000,link:'https://meli.la/teste',img:'https://http2.mlstatic.com/teste.jpg',em:'2026-10-20T03:00:00Z',conferido:'2026-10-20T02:59:00Z',categoria:'casa',...extra});

test('cupom sem elegibilidade comprovada ou excluído não vira preço',()=>{
  for(const extra of [{},{elegibilidadeConfirmada:false},{elegibilidadeConfirmada:true,automatico:0},{elegibilidadeConfirmada:true,condicoes:{prime:true}}]) {
    const p=R.precoComCondicoes(oferta({cupom:{tipo:'pct',valor:20,minimo:5000,...extra}}),agora);
    assert.equal(p.principal.valor,10000);
    assert.match(p.condicoes.join(' '),/confir|condiç|exclu/i);
  }
});
test('cupom confirmado respeita mínimo, teto e validade e nunca acumula Pix',()=>{
  const cupom={tipo:'pct',valor:20,minimo:5000,teto:1000,elegibilidadeConfirmada:true,validade:'2026-10-20'};
  const p=R.precoComCondicoes(oferta({pix:8500,cupom}),agora);
  assert.equal(p.principal.valor,8500);
  assert.ok(p.alternativas.some(a=>a.valor===9000&&a.tipo==='cupom'));
  const baixo=R.precoComCondicoes(oferta({preco:4000,cupom}),agora);
  assert.equal(baixo.principal.valor,4000);
  assert.match(baixo.condicoes.join(' '),/sozinho|carrinho/);
  assert.equal(R.precoComCondicoes(oferta({cupom:{...cupom,validade:'2026-10-19'}}),agora).principal.valor,10000);
});
test('preço já com cupom não desconta duas vezes nem combina Pix sem prova',()=>{
  const p=R.precoComCondicoes(oferta({jaComCupom:true,pix:9000,cupom:{tipo:'pct',valor:20,elegibilidadeConfirmada:true}}),agora);
  assert.equal(p.principal.valor,10000);
  assert.match(p.principal.rotulo,/cupom/);
  assert.match(p.condicoes.join(' '),/Pix/);
});
test('ausência ou invalidez da coleta não vira conferência pela publicação',()=>{
  for(const conferido of [null,undefined,'inválido','2027-01-01T00:00:00Z']) {
    const o=oferta({conferido});
    assert.equal(R.situacao(o,agora).precoAtual,false);
    assert.doesNotMatch(R.quandoTexto(o,agora),/Publicada e conferida|preço conferido há/);
  }
  assert.equal(R.situacao(oferta(),agora).precoAtual,true);
});
test('compartilhamento antigo não promete preço atual e conserva URL afiliada',()=>{
  const t=R.textoCompartilhar(oferta({conferido:'2026-10-17T00:00:00Z'}),'https://adiretoria.github.io/',agora);
  assert.match(t,/confira o preço atual/);
  assert.match(t,/https:\/\/meli.la\/teste/);
  const atual=R.textoCompartilhar(oferta({pix:9000}),'https://adiretoria.github.io/',agora);
  assert.match(atual,/90,00 no Pix/);
  assert.match(atual,/Mercado Livre/);
});
test('categoria de mochila para notebook continua moda; termos desconhecidos vão a Outras',()=>{
  assert.equal(R.categoriaDoNome('Mochila para notebook impermeável'),'moda');
  assert.equal(R.categoriaDoNome('Produto sem categoria'),'outras');
  assert.equal(R.categoriaDoNome('Bicicleta ergométrica fitness'),'esportes');
  assert.equal(R.categoriaDoNome('Camiseta dry-fit para academia'),'moda');
});

test('cupom anunciado não prova desconto já aplicado; condição acompanha compartilhamento',()=>{
  const o=oferta({cupomAnunciado:true});
  assert.equal(R.precoComCondicoes(o,agora).principal.valor,10000);
  assert.match(R.textoCompartilhar(o,'https://adiretoria.github.io/',agora),/nenhum desconto extra/);
  assert.equal(R.cupomVigente({validade:'2026-10-20'},Date.parse('2026-10-21T02:59:59Z')),true);
  assert.equal(R.cupomVigente({validade:'2026-10-20'},Date.parse('2026-10-21T03:00:00Z')),false);
  assert.equal(R.situacao(oferta({jaComCupom:true,cupom:{validade:'2026-10-19'}}),agora).precoAtual,false);
});
test('filtros combinam termos, loja, categoria, preço e anteriores; sem preço não vira zero',()=>{
  const lista=[oferta(),oferta({id:2,loja:'amazon',nome:'Panela Amazon',preco:null}),oferta({id:3,nome:'Panela antiga',em:'2026-10-15T00:00:00Z'}),oferta({id:4,nome:'Tênis',categoria:'moda',preco:4000})];
  assert.deepEqual(R.filtrarOfertas(lista,{q:'panela',loja:'mercadolivre',categoria:'casa',faixa:'ate100'},agora).map(x=>x.id),[1]);
  assert.deepEqual(R.filtrarOfertas(lista,{q:'panela',anteriores:true},agora).map(x=>x.id),[1,2,3]);
  assert.equal(R.filtrarOfertas(lista,{q:'panela',faixa:'ate50'},agora).length,0);
  assert.equal(R.filtrarOfertas(lista,{ordem:'menor'},agora).at(-1).id,2);
});
test('destaques usam dados atuais, diversificam categorias e não confundem nomes vazios',()=>{
  assert.equal(R.parecidos('',''),false);
  const itens=[oferta(),oferta({id:2,nome:'Notebook 16 GB',categoria:'tecnologia'}),oferta({id:3,nome:'Tênis de corrida',categoria:'moda'}),oferta({id:4,nome:'Panela elétrica inox'}),oferta({id:5,nome:'Produto antigo',conferido:null}),oferta({id:6,nome:'Item sem imagem',img:null})];
  const ds=R.escolhasDaDiretoria(itens,agora);
  assert.deepEqual(ds.map(x=>x.id),[1,2,3]);
});
test('valores não finitos, negativos ou zero não geram preços compráveis',()=>{
  for(const preco of [NaN,Infinity,-5,0])assert.equal(R.precoComCondicoes(oferta({preco}),agora),null);
});
