import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { montarDados, linkSeguro } from '../exportador/exportar.js';

// Banco mínimo com as colunas que o exportador lê (o robô real tem mais).
function banco() {
  const db = new DatabaseSync(':memory:');
  db.exec(`create table ofertas (id integer primary key, loja text, nome text, preco_cent integer, preco_original_cent integer, preco_pix_cent integer,
    imagem text, afiliado text, selo text, cupom_loja text, enviado_em text, revisao text);
  create table cupons_lojas (id integer primary key, loja text, campanha text, titulo text, subtitulo text, tipo text, valor real,
    minimo_cent integer, teto_cent integer, validade text, enviado_em text);
  create table envios (id integer primary key, texto text, origem text, cupom_id integer);`);
  const o = db.prepare("insert into ofertas (loja, nome, preco_cent, preco_original_cent, imagem, afiliado, selo, enviado_em, revisao) values (?,?,?,?,?,?,?,?,?)");
  o.run('amazon', 'Publicada', 10000, 20000, 'https://m.media-amazon.com/x.jpg', 'https://amzn.to/abc', '{amount} OFF com Cupom · Menor preço observado desde 04/10', "2026-01-01 00:00:00".replace('2026-01-01', new Date().toISOString().slice(0, 10)), null);
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

test('links: só https das lojas, sem porta nem credenciais', () => {
  assert.equal(linkSeguro('https://meli.la/abc'), 'https://meli.la/abc');
  for (const u of ['http://meli.la/abc', 'https://meli.la:8443/x', 'https://u:p@amzn.to/x', 'https://evil.example/x', 'https://amzn.to.evil.example/', 'javascript:alert(1)']) {
    assert.equal(linkSeguro(u), null, u);
  }
});

test('grupos: só convites do WhatsApp e do Telegram', () => {
  const d = montarDados(banco());
  assert.deepEqual(Object.keys(d.grupos), ['telegram']); // WhatsApp vazio no config até ser informado
});
