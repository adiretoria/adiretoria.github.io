import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { montarDados, linkSeguro } from '../exportador/exportar.js';

// Banco mínimo com as colunas que o exportador lê (o robô real tem mais).
function banco() {
  const db = new DatabaseSync(':memory:');
  db.exec(`create table ofertas (id integer primary key, loja text, nome text, preco_cent integer, preco_original_cent integer, preco_pix_cent integer,
    imagem text, afiliado text, selo text, cupom_loja text, enviado_em text, revisao text,
    coletado text, editado_em text, categoria text, fonte text, dados_comerciais text);
  create table cupons_lojas (id integer primary key, loja text, campanha text, titulo text, subtitulo text, tipo text, valor real,
    minimo_cent integer, teto_cent integer, validade text, enviado_em text);
  create table envios (id integer primary key, texto text, origem text, cupom_id integer);`);
  const o = db.prepare("insert into ofertas (loja, nome, preco_cent, preco_original_cent, imagem, afiliado, selo, enviado_em, revisao) values (?,?,?,?,?,?,?,?,?)");
  o.run('mercadolivre', 'Publicada', 10000, 20000, 'https://http2.mlstatic.com/x.jpg', 'https://meli.la/abc', '{amount} OFF com Cupom · Menor preço observado desde 04/10', "2026-01-01 00:00:00".replace('2026-01-01', new Date().toISOString().slice(0, 10)), null);
  o.run('amazon', 'Só na fila', 10000, null, null, 'https://amzn.to/x', null, null, null);
  o.run('mercadolivre', 'Em revisão', 10000, null, null, 'https://meli.la/x', null, new Date().toISOString().slice(0, 19).replace('T', ' '), 'preço não confirmado');
  o.run('shopee', 'Link estranho', 10000, null, 'javascript:alert(1)', 'https://evil.example/x', null, new Date().toISOString().slice(0, 19).replace('T', ' '), null);
  o.run('magalu', 'Antiga', 10000, null, null, 'https://www.magazinevoce.com.br/t/p/abc/', null, '2020-01-01 00:00:00', null);
  const c = db.prepare("insert into cupons_lojas (loja, campanha, titulo, tipo, valor, validade, enviado_em) values (?,?,?,?,?,?,datetime('now'))");
  c.run('mercadolivre', '1', '10% OFF', 'pct', 10, '2099-01-01T00:00:00Z');
  c.run('mercadolivre', '2', 'Vencido', 'pct', 10, '2000-01-01T00:00:00Z');
  c.run('shopee', '3', 'Eletrônicos', 'comissao', 12, null);
  db.prepare("insert into envios (texto, origem, cupom_id) values ('🎟️ *CUPOM*\n🛒 Produtos: https://meli.la/cupom1', 'cupom Mercado Livre #1', 1)").run();
  return db;
}

test('só vai para o site o que foi publicado nos grupos, sem revisão pendente e com link de loja', () => {
  const d = montarDados(banco());
  assert.deepEqual(d.ofertas.map((o) => o.nome), ['Publicada']);
  const [o] = d.ofertas;
  assert.equal(o.de, 20000);
  assert.equal(o.selo, 'Menor preço observado desde 04/10'); // parte com marcador não preenchido sai
  assert.match(o.em, /Z$/);
});

test('cupons: válidos, com o link de compra publicado; comissão da Shopee fica fora', () => {
  const d = montarDados(banco());
  assert.deepEqual(d.cupons.map((c) => [c.titulo, c.link]), [['10% OFF', 'https://meli.la/cupom1']]);
});

test('exporta coleta real, condição estruturada e origem sem inventar elegibilidade', () => {
  const db = banco();
  const cupom = {tipo:'fixo',valor:80,minimo_cent:40000,teto_cent:10000,automatico:1,validade:'2099-01-01',codigo:'OFERTA'};
  db.prepare('update ofertas set coletado=?,fonte=?,cupom_loja=? where id=1').run('2026-10-20 02:00:00','busca #1',JSON.stringify(cupom));
  const [o] = montarDados(db).ofertas;
  assert.equal(o.conferido,'2026-10-20T02:00:00.000Z');
  assert.equal(o.origem,'automatica');
  assert.equal(o.cupom.minimo,40000);
  assert.equal(o.cupom.teto,10000);
  assert.notEqual(o.cupom.elegibilidadeConfirmada,true);
  assert.equal(o.jaComCupom,false);
  assert.equal(o.cupomAnunciado,true);
  assert.equal(o.categoria,'outras');
  db.prepare('update ofertas set coletado=null,editado_em=null where id=1').run();
  assert.equal(montarDados(db).ofertas[0].conferido,null);
  db.prepare('update ofertas set selo=? where id=1').run('10% OFF usando cupom (preço já com o cupom)');
  assert.equal(montarDados(db).ofertas[0].jaComCupom,true);
});

test('link de cupom preserva sublinhados e prioriza o envio exato da mesma loja', () => {
  const db=banco();
  const link='https://www.mercadolivre.com.br/item?affiliate_id=abc_123&tracking_id=xyz~456';
  db.prepare('update envios set texto=? where id=1').run(`Produtos: ${link}`);
  db.prepare('insert into envios(texto,origem,cupom_id) values(?,?,?)').run('https://shope.ee/errado','cupom Shopee #1',999);
  assert.equal(montarDados(db).cupons[0].link,link);
  db.prepare('delete from envios where id=1').run();
  assert.equal(montarDados(db).cupons.length,0);
});

test('ASIN em domínio estranho não vira produto da Amazon', async () => {
  const {linkAmazon}=await import('../exportador/exportar.js');
  assert.equal(linkAmazon('https://evil.example/dp/B0BZ129NTZ','nova-20'),null);
});

test('preserva cupom fixo com mínimo de carrinho e aviso de saldo com espaço Unicode', () => {
  const db=banco();
  db.prepare('update ofertas set selo=? where id=1').run('Cupom de R$ 20,00 OFF em compras acima de R$ 350,00');
  assert.deepEqual(montarDados(db).ofertas[0].cupomMinimo,{tipo:'fixo',valor:20,minimo:35000});
  db.prepare('update ofertas set selo=? where id=1').run('5% OFF com Saldo no Mercado\u202fPago');
  const [o]=montarDados(db).ofertas;
  assert.match(o.condicoesLoja.join(' '),/Saldo no Mercado Pago/);
  assert.equal(o.rotuloPreco,undefined);
});

test('links: só https das lojas, sem porta nem credenciais', () => {
  assert.equal(linkSeguro('https://meli.la/abc'), 'https://meli.la/abc');
  for (const u of ['http://meli.la/abc', 'https://meli.la:8443/x', 'https://u:p@amzn.to/x', 'https://evil.example/x', 'https://amzn.to.evil.example/', 'javascript:alert(1)']) {
    assert.equal(linkSeguro(u), null, u);
  }
});

test('grupos: só convites do WhatsApp e do Telegram', () => {
  const d = montarDados(banco());
  assert.deepEqual(Object.keys(d.grupos).sort(), ["telegram", "whatsapp"]);
});

test('Amazon: fora do site com a conta inativa; ativa, só nome e link direto com a tag (sem preço, imagem ou selo)', async () => {
  const { config } = await import('../exportador/exportar.js');
  assert.equal(montarDados(banco()).ofertas.some((o) => o.loja === 'amazon'), false);
  const db = banco();
  db.prepare("update ofertas set loja = 'amazon', afiliado = 'https://www.amazon.com.br/dp/B0BZ129NTZ?tag=velha-20' where nome = 'Publicada'").run();
  config.amazon = { ativo: true, tag: 'nova-20' };
  try {
    const d = montarDados(db);
    const [o] = d.ofertas.filter((x) => x.loja === 'amazon');
    assert.deepEqual(o && Object.keys(o).sort(), ['asin', 'em', 'id', 'link', 'loja', 'nome']);
    assert.equal(o.link, 'https://www.amazon.com.br/dp/B0BZ129NTZ?tag=nova-20');
    assert.deepEqual(d.amazon, { tag: 'nova-20' });
  } finally {
    config.amazon = { ativo: false, tag: '' };
  }
});
