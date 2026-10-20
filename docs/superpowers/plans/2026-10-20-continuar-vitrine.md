# Continuação da vitrine — Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Concluir a vitrine pedida pelo usuário, revisando e aproveitando a implementação interrompida do Claude.

**Architecture:** Regras puras compartilhadas pelo exportador e navegador; HTML/CSS estáticos e dados JSON públicos. Exportador SQLite somente leitura. Nenhuma dependência nova.

**Tech Stack:** JavaScript ESM, node:test, node:sqlite, HTML/CSS e inspeção por navegador.

**Spec:** ../../continuidade-site.md e prompt aprovado nesta conversa.

## Global Constraints

- Preservar marca, rastreamento de afiliado e operação do robô.
- Não inventar elegibilidade, coleta, histórico, contato ou reputação.
- Amazon sem preços/imagens/histórico; preservar declaração e página intermediária.
- Sem mensagens ou compras reais durante validação.

## Review Focus

- Cupom desconhecido, excluído ou condicionado não reduz preço.
- Datas inválidas, futuras e ausentes não parecem conferência recente.
- Busca digitada e troca de aba não disputam estado atrasado.
- Filtros sem preço, anteriores e URLs antigas mantêm comportamento previsível.
- Links com credenciais/portas/domínios falsos não são expostos.

## Tarefas

- [x] 1. Regras: escrever `test/regras.test.js`, observar falhas e corrigir `regras.js` (preço, datas, categoria, destaques, filtros e compartilhamento).
- [x] 2. Exportação: ampliar `test/exportar.test.js`, observar falhas e integrar dados estruturados em `exportador/exportar.js`, mantendo as colunas antigas compatíveis e o banco somente leitura.
- [x] 3. Interface: integrar regras em `app.js`, reorganizar `index.html`, ajustar `estilo.css`; busca no topo, filtros e estados, preço explícito, seleção diversa, fonte/atualidade e compartilhamento consistente.
- [x] 4. Validar: suíte completa, exportação real somente leitura, inspeção no navegador em desktop/celular e fluxos negativos. Uma rodada de correções motivadas pelas evidências.
- [x] 5. Revisão independente: revisor examina implementação completa; resolver achados importantes com regressões.
- [x] 6. Entregar: sincronizar arquivos finais com o projeto original, preservar alterações do Claude, registrar resultado e distinguir código validado da versão pública.

## Registro de execução

- Baseline: 5 testes do exportador aprovados. `regras.js` original sem testes/integração.
- Decisão: preparar em cópia dentro do workspace autorizado e sincronizar o projeto original com ferramenta autorizada após validação; isso evita expor ao exportador agendado uma implementação intermediária.

- Entrega validada: 19 testes aprovados no estágio e no projeto original; revisão independente sem P1 restante; fluxos de erro/recuperação, filtros e URL antiga verificados no navegador.
