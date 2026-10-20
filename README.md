# A Diretoria: site de ofertas

Vitrine pública das ofertas que A Diretoria publica nos grupos de WhatsApp e Telegram. É um site
estático (GitHub Pages, gratuito). O visitante busca o produto, filtra por loja, ordena e vai direto
à loja pelo link de afiliado. Os cupons válidos ficam numa aba própria.

## Como os produtos chegam aqui

O robô [radar-ofertas](https://github.com/paparidisbrancher/radar-ofertas) publica nos grupos. A cada
15 minutos, `exportador/exportar.js` lê o banco do robô **só para leitura** e grava `dados/ofertas.json`.
Se algo mudou, ele faz commit e push, e o GitHub Pages atualiza o site em 1 a 2 minutos.

O que entra:
- ofertas publicadas nos grupos nos últimos 7 dias (entrega confirmada pelo canal), com preço, link
  https de loja e sem "revisão necessária" no robô;
- cupons publicados nos grupos e ainda válidos, com o mesmo link de compra que foi para o grupo. As
  campanhas de comissão da Shopee ficam de fora, porque não são desconto para o cliente.

O preço mostrado é o do momento da publicação. O site mostra há quanto tempo a oferta foi aprovada e,
depois de 24 h, avisa que o preço pode ter mudado.

## Configurar

`exportador/config.json`:
- `grupos.whatsapp` / `grupos.telegram`: links de convite (`https://chat.whatsapp.com/...`, `https://t.me/...`).
  O botão só aparece quando o link está preenchido.
- `banco`: caminho do `radar.db` do robô (relativo à pasta do site; padrão: a pasta irmã `radar-ofertas`).
- `dias` / `maxOfertas`: janela e limite da lista.

## Comandos

- `npm run exportar`: gera `dados/ofertas.json` sem publicar.
- `npm run publicar`: gera e envia ao GitHub.
- `npm test`: testes do exportador.
- `powershell -ExecutionPolicy Bypass -File exportador\agendar.ps1`: liga a atualização a cada 15 min
  (`-Remover` desliga; o site continua no ar com a última lista).

## Segurança

- O site e o exportador só aceitam links https das lojas atendidas (Amazon, Mercado Livre, Shopee e
  Magalu), sem porta nem credenciais. Os textos entram na página como texto, nunca como HTML.
- Nenhum segredo vai para este repositório. O JSON tem só dados públicos das ofertas e links de afiliado.

Fontes Manrope e JetBrains Mono sob SIL OFL (`fontes/`).
