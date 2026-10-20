# Verificação da continuidade — 20/10/2026

## Estado e escopo

Revisado o site em `b31c993` e o módulo `regras.js` deixado sem integração. O atualizador de dados continuou
executando durante o trabalho (HEAD passou a `25c4cec`). Alterações preparadas e validadas numa cópia local;
nenhuma configuração ou linha do banco do robô foi modificada. O exportador abre SQLite com `readOnly: true`.

## Correções com reprodução

- Cupom sem elegibilidade conhecida não gera preço calculado; mínimo, teto e validade são respeitados.
- Pix e cupom são opções separadas; marcador explícito de preço já com cupom evita desconto duplicado.
- Etiqueta separada `OFF com Cupom` não prova desconto incluído. Conferido contra o parser real do robô.
- Publicação não substitui coleta ausente, inválida ou futura; valores antigos são identificados.
- URLs de cupons conservam sublinhados e `~`; envio exato é priorizado e fallback exige mesma loja/campanha.
- ASIN em domínio externo é rejeitado. Portas, credenciais e outros hosts continuam rejeitados.
- Condições de saldo com espaço Unicode e cupom fixo com compra mínima são preservadas.
- Cupons vencidos saem também no navegador. Datas sem hora encerram no fim do dia em Brasília.

## Verificações executadas

- `npm test`: 19 testes, 19 aprovados. Casos novos reproduziram falhas antes das correções.
- Exportação de 187 ofertas e 100 cupons do banco real, somente leitura, sem publicar durante a preparação.
- Navegador desktop e viewport 390 × 844; busca dentro da primeira tela (aproximadamente y=477).
- Controles medidos com altura mínima de 44 px; sem transbordamento horizontal da página.
- Busca por mochila + Mercado Livre + Moda + até R$ 100: quatro ofertas recentes compatíveis.
- Aviso de cupom de 5% acima de R$ 381 visível na mochila de R$ 94,98 no Pix e na mensagem de compartilhamento.
- Anteriores: 81 recentes por padrão, 187 ao incluir anteriores, no catálogo usado na validação.
- Abas por teclado (End), estados vazios e erro 503, nova tentativa e recuperação com dados restaurados.
- `?oferta=33`: oferta antiga trazida ao topo, preço registrado e aviso de conferir a loja também no compartilhamento.
- Links de WhatsApp inspecionados sem envio de mensagens; nenhum clique de compra foi realizado.
- Revisão independente: correções de cupom/condições confirmadas; nenhum P1 restante no escopo revisado.

## Limites

Não houve teste de compra ou de atribuição de comissão. Não se pode inferir conversão ou elegibilidade individual
a partir de uma inspeção da interface. A referência de preço é fornecida pela loja; não representa menor preço
de todo o mercado. Não foram criadas avaliações, contagens de vendas ou promessas de estoque.

O comentário das capturas de que nenhum link Amazon havia sido enviado não foi adotado como fato: a leitura
do banco encontrou entregas Amazon confirmadas e Amazon ainda presente na busca automática 1. Esse diagnóstico
não alterou o robô. A vitrine mantém os cartões Amazon sem preço/imagem e o compartilhamento pela página intermediária.
Isso não atesta a situação contratual da conta nem substitui a conferência do cadastro e das políticas oficiais.
