# Voltar ao Programa de Associados Amazon sem ser recusado de novo

Escrito em 19/10/2026, depois da recusa da conta `adiretoria0d-20`.

## Por que a conta foi recusada

O e-mail da Amazon diz que não encontrou o ID de rastreamento nos links do site cadastrado (o Instagram
`@adiretoriacompras`). Por isso não conseguiu saber de onde vinha o tráfego. Os links iam direto para os grupos de
WhatsApp e Telegram, que não são públicos nem estavam cadastrados. O Instagram não tinha links da Amazon.

Pelas regras oficiais, havia ainda outros problemas:

| Regra (Contrato Operacional / Políticas) | O que acontecia | Situação agora |
|---|---|---|
| Declaração "Como participante do Programa de Associados da Amazon, sou remunerado pelas compras qualificadas efetuadas" no site | não existia | no site, em cada card e na página intermediária |
| Preço e disponibilidade só via API da Amazon | o robô copiava da página da Amazon e publicava | o site não mostra preço nem imagem da Amazon |
| Sem robôs de coleta de dados no site da Amazon | o robô lia a página de ofertas da Amazon | busca automática da Amazon **desligada** em 19/10 |
| Sem rastreamento ou alerta de preço | selo "menor preço observado" | sem selo nas ofertas da Amazon |
| "Todos os Links Especiais deverão ser acessados diretamente a partir de seu Site" | links soltos nos grupos | página intermediária pronta (`/amazon/?asin=...`) |

## Antes de se inscrever de novo

1. Cadastre o **site** como site principal na "Lista de sites ou apps":
   `https://adiretoria.github.io/`.
   Cadastre o Instagram só se ele tiver links da Amazon com a tag. A ajuda da Amazon fala em redes públicas com
   pelo menos 500 seguidores.
2. Logo depois da inscrição a Amazon já dá a nova tag (`xxxxx-20`), com a conta "temporariamente aprovada".
   Coloque essa tag em:
   - `exportador/config.json` do site: `"amazon": { "ativo": true, "tag": "xxxxx-20" }`;
   - Ajustes do robô (tag da Amazon).
3. Confira se o site mostra ofertas da Amazon com a tag nova. A revisão acontece depois das primeiras visitas, e
   a Amazon precisa encontrar links com a tag **no site cadastrado**.
4. Nos grupos, divulgue o link da página intermediária da oferta
   (`https://adiretoria.github.io/amazon/?asin=ASIN`), não o link direto da Amazon.
   **Isso exige uma mudança no robô** (o link da Amazon na mensagem vira o link da página). Ela ainda não foi feita
   porque há trabalho do Codex sem commit na pasta do robô.
5. Não volte a ligar a busca automática da Amazon com coleta de páginas. O caminho permitido para preço, imagem e
   ofertas é a API da Amazon (Creators API / API de Divulgação de Produtos), que exige a conta aprovada e
   credenciais próprias.

## O que nunca fazer

- Comprar pelos próprios links ou pedir a amigos e família que comprem.
- Usar encurtador que não deixe claro que o destino é a Amazon, ou redirecionar automaticamente.
- Usar "Amazon" no nome do grupo, do perfil ou do domínio.
- Oferecer prêmio ou recompensa para quem comprar pelo link.

Fontes: [Políticas do Programa](https://associados.amazon.com.br/help/operating/policies/),
[Contrato Operacional](https://associados.amazon.com.br/help/operating/agreement/),
[Central de Conhecimento: redes sociais](https://associados.amazon.com.br/resource-center/how-to-use-social-media-on-associates-program),
[Ajuda: ID de rastreamento](https://associados.amazon.com.br/help/node/topic/GFZ6X2S7P8EVNGN2).
