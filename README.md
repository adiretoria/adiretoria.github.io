# A Diretoria: site de ofertas

Vitrine pública das ofertas que A Diretoria publica nos grupos de WhatsApp e Telegram. É um site
estático (GitHub Pages, gratuito). O visitante busca o produto, filtra por loja, ordena e vai direto
à loja pelo link de afiliado. Os cupons válidos ficam numa aba própria.

## Como os produtos chegam aqui

O robô de ofertas (repositório privado) publica nos grupos. A cada
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

## Amazon (Programa de Associados)

Regras do Contrato Operacional e das Políticas do programa, que o site segue:
- **Declaração obrigatória** em cada card da Amazon, na página intermediária e no rodapé: "Como participante do
  Programa de Associados da Amazon, sou remunerado pelas compras qualificadas efetuadas."
- **Sem preço, imagem, avaliação ou selo de histórico da Amazon.** Esses dados só podem vir da API da Amazon,
  e o robô não a usa. O card mostra o nome e "Ver preço na Amazon".
- **Link direto** `https://www.amazon.com.br/dp/ASIN?tag=SUA-TAG`, sem encurtador e sem redirecionamento automático.
- **Página intermediária** `amazon/?asin=ASIN`: é o link que deve ir para os grupos no lugar do link da Amazon,
  para o clique sair do site cadastrado. Ela só leva à Amazon quando a pessoa clica.
- A Amazon só aparece com `amazon.ativo: true` e uma tag válida em `exportador/config.json`. Com a conta
  fechada, fica desligada.

Passo a passo para pedir de novo: [docs/amazon-associados.md](docs/amazon-associados.md).

## Segurança

- O site e o exportador só aceitam links https das lojas atendidas (Amazon, Mercado Livre, Shopee e
  Magalu), sem porta nem credenciais. Os textos entram na página como texto, nunca como HTML.
- Nenhum segredo vai para este repositório. O JSON tem só dados públicos das ofertas e links de afiliado.

Fontes Anton e Archivo sob SIL OFL (`fontes/`, só os caracteres usados em português). Logo, avatar e capa do material da marca (`img/`).
