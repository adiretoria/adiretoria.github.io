# Continuidade da vitrine A Diretoria

## Escopo aprovado

Concluir o prompt de melhorias fornecido nesta conversa e a implementação interrompida do Claude. Preservar a marca, GitHub Pages, links de afiliado, página intermediária Amazon e operação do robô. A vitrine é estática, em HTML/CSS/JavaScript, com exportação SQLite somente leitura.

## Estado encontrado

HEAD local: b31c993. Compartilhamento direto, abas, filtro de lojas, carrossel, lista móvel e barra dos grupos já funcionam. Cinco testes cobrem o exportador. `regras.js` está sem commit e não é importado pela página nem pelo exportador; foi preservado em `regras-claude-original.txt` para comparação. O restante do trabalho ainda não foi integrado.

## Decisões de implementação

- Preservar a identidade de ata, Anton/Archivo, papel/azul/lima e o fluxo direto para a loja.
- Só calcular preço de cupom com elegibilidade explicitamente confirmada. Restrições desconhecidas viram texto. Não somar Pix com cupom nem descontar benefício já incluído.
- Exportar dados comerciais públicos estruturados; nunca vazar configuração interna. Conferência vem de coleta/edição real, sem substituí-la pela publicação.
- Considerar recentes as publicações de até 48 h; depois, exibi-las apenas mediante opção de anteriores. Preço com mais de 24 h de coleta/edição é histórico, com rótulo próprio e fora dos destaques.
- Ofertas Amazon continuam somente com nome, ASIN, link e data de publicação; sem preço, imagem ou histórico.
- Busca logo após abertura compacta. Categorias/faixas combináveis, filtros ativos, limpeza, contagem e estados vazios. Itens sem preço não entram em faixas ou no começo da ordenação de preço.
- Até seis destaques recentes e com preço conferido, limitados a dois por categoria e sem produtos muito semelhantes. Sem inventar motivos de aprovação.
- Compartilhamento consistente com preço/condições do cartão e com os links existentes.
- Sem novas dependências e sem mensagens reais nos testes. Verificação visual no navegador para desktop e celular.

## Limites de dados

O banco contém publicação e coleta distintas. O preço da tabela `ofertas` pode ser atualizado após a publicação, portanto a vitrine deve descrever a coleta, sem afirmar que é uma fotografia imutável do texto enviado. Dados antigos sem coleta explícita não são tratados como recém-conferidos. Categorias inferidas são apenas organização do catálogo, não prova de qualidade.

## Critério de entrega

Testes de regras e exportação aprovados; inspeção visual e dos fluxos de busca/filtros/abas/compartilhamento; fonte final sincronizada com o projeto original sem apagar o trabalho anterior; situação da publicação informada explicitamente.
