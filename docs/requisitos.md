# Divas Black · requisitos do MVP

Aplicativo operacional para Carina organizar clientes, atendimentos, caixa e materiais. O pedido da equipe define esta entrega; o documento do hackathon foi tratado como contexto e conjunto de propostas, sem transformar todas as sugestões em funcionalidades obrigatórias.

## Requisitos funcionais

| ID | Entrega |
| --- | --- |
| RF01 | Painel com recebido, gasto, saldo do período, valores a receber, agenda próxima e evolução mensal. |
| RF02 | Agenda por dia/semana/mês, com post-its coloridos pelo serviço e informação de cliente, horário e pagamento. |
| RF03 | Criar, editar, remarcar, concluir, cancelar e marcar ausência em atendimentos. |
| RF04 | Cadastrar, editar, pesquisar e arquivar clientes; consultar histórico de atendimentos. |
| RF05 | Cadastrar/editar serviços com preço padrão, custo estimado, duração, cor e receita estimada de materiais; ajustar custo por atendimento. |
| RF06 | Registrar sinal, pagamento parcial e pagamento restante no próprio atendimento; refletir automaticamente no financeiro. |
| RF07 | Registrar entradas e custos/despesas avulsas do salão pela ação “Adicionar custo”, com valor, categoria e data; filtrar movimentações por período e tipo. |
| RF08 | Registrar reembolso vinculado ao atendimento sem apagar o pagamento original. |
| RF09 | Cadastrar materiais com unidade, saldo inicial e mínimo; registrar compra, uso e ajuste. |
| RF10 | Gerar lista de compra pela agenda e saldo, somar demanda manual editável e manter Pomada/Mousse sempre visíveis, mesmo sem falta. |
| RF11 | Mostrar sugestão simulada da assistente; revisar os campos e confirmar uma única vez. |
| RF12 | Salvar demonstração no navegador ou, quando configurado, em banco compartilhado Supabase. |
| RF13 | Funcionar em celular e computador com navegação curta, números grandes e ações rápidas. |
| RF14 | Baixar PDF da lista de compra do período no navegador, incluindo demanda automática, manual e materiais fixos, sem envio para geração externa. |
| RF15 | Alternar tema claro/escuro e recolher o menu lateral no desktop, preservando preferências locais; usar tema do sistema quando não houver escolha salva. |

## Regras de negócio

- **RN01 — Previsão versus caixa:** agendar cria valor previsto. Somente um recebimento confirmado vira entrada. Concluir não implica pagamento.
- **RN02 — Pagamentos:** saldo do atendimento = preço combinado − entradas vinculadas + reembolsos. Bloquear recebimento acima do saldo e reembolso acima do total líquido recebido.
- **RN03 — Estados separados:** situação do atendimento (`confirmed`, `completed`, `cancelled`, `noshow`) é independente de não pago/parcial/pago, calculado pelo caixa vinculado.
- **RN04 — Conflitos:** uma profissional no MVP. Intervalos ativos não podem sobrepor; terminar exatamente no início do próximo é permitido. Concluídos preservam ocupação histórica. Cancelados e ausências liberam o intervalo.
- **RN05 — Histórico:** preço, custo estimado, duração, nome, cor e receita são copiados para o atendimento. Editar serviço não reescreve atendimentos antigos. Alterar serviço de um atendimento usa a receita e o custo estimado do novo serviço; se o formulário enviar valores explícitos, eles prevalecem. Remarcar mantendo o serviço preserva os snapshots.
- **RN06 — Remarcação e cancelamento:** pagamentos permanecem registrados. Cancelamento remove a previsão restante; devolução exige reembolso explícito. Atendimento concluído não pode ser remarcado nem voltar de estado.
- **RN07 — Identidade:** cada comando tem `commandId`; repetição do mesmo comando não duplica efeitos. IDs de movimentos também são únicos. Sugestão já confirmada não gera outro atendimento.
- **RN08 — Cadastro:** registros são arquivados, sem exclusão em cascata. Novos atendimentos exigem cliente e serviço ativos; histórico permanece legível.
- **RN09 — Estoque:** compra aumenta saldo e gera saída paga na mesma operação. Uso reduz estoque sem criar nova despesa. Ajuste não gera caixa. Não permitir saldo físico negativo.
- **RN10 — Necessidade de compra:** para cada material ativo, `demanda = agenda confirmada no período + demanda manual`; `falta = máximo(0, demanda + mínimo − quantidade atual)`. A agenda usa a receita salva no atendimento uma única vez. A demanda manual é um complemento global, editável até ser corrigido/zerado; não muda estoque nem caixa. Não há desconto físico de reservas. Cancelados, ausências e concluídos não contam como demanda futura. Pomada e Mousse permanecem visíveis mesmo quando a falta é zero.
- **RN11 — Consumo:** concluir não baixa automaticamente materiais; registrar uso real na tela de materiais. A lista representa estimativa e depende das receitas e saldos cadastrados.
- **RN12 — Datas e valores:** dinheiro em centavos inteiros; datas de caixa em `YYYY-MM-DD`; instantes com timezone, exibidos em `America/Sao_Paulo`. Filtros financeiros usam data efetiva do caixa; previsão usa data local do serviço.
- **RN13 — Indicadores:** saldo do período é recebido menos gasto no período, sem pressupor saldo bancário inicial. Não rotular como lucro contábil. A receber exclui atendimentos cancelados e ausências.
- **RN14 — Integridade:** validação em servidor e domínio; falha não produz atualização parcial. Erros de leitura/armazenamento não apagam dados nem convertem falha do banco em sucesso local.
- **RN15 — Escopo da compra:** toda compra registrada já foi paga. Compras a prazo, contas recorrentes, fornecedores, entregas futuras e reservas físicas ficam para evolução.
- **RN16 — Dois tipos de custo:** “Adicionar custo” registra despesa efetivamente paga no caixa. Custo estimado de serviço/atendimento é informativo: não gera saída de caixa, não muda estoque e não representa automaticamente lucro. Valores em centavos inteiros não negativos. Campo ausente em dados antigos permanece compatível, usando zero quando necessário.
- **RN17 — Materiais fixos e dados antigos:** ao ler uma demonstração existente, acrescentar Pomada/Mousse somente quando ausentes e reutilizar cadastro de mesmo nome sem distinguir maiúsculas. Preservar IDs, saldos, mínimos e demanda manual; marcar os fixos ativos e visíveis na lista. Os saldos iniciais zero e mínimos de uma unidade são exemplos fictícios ajustáveis. Não redefinir os demais dados da usuária.
- **RN18 — Exportação:** o PDF usa a mesma lista e período consultados, com estoque, demanda e quantidade faltante; materiais fixos continuam presentes com falta zero. Gerar e baixar o arquivo não altera estoque ou caixa e não transmite os dados para serviço de conversão.
- **RN19 — Apresentação:** tema e menu recolhido são preferências locais do navegador, independentes dos dados operacionais. No celular, cartões de atendimento ficam em uma coluna. Saudação apenas no início; cabeçalho da agenda sem subtítulo redundante.

## Fora desta entrega

Login, perfis de equipe, integração real de WhatsApp, agente de IA real, processamento bancário, comissões, obrigações tributárias, formação social e contabilidade completa. Sugestões da assistente e registros de exemplo são fictícios. O módulo externo da outra integrante da equipe deve respeitar o mesmo contrato e as mesmas regras.

## Critérios de aceite

1. Cadastrar cliente e serviço, agendar e encontrar o post-it na data correta.
2. Registrar R$ 50 em um serviço de R$ 300: recebido aumenta R$ 50, pendente fica R$ 250. Concluir não duplica entrada.
3. Registrar entrada/saída avulsa: painel e filtros refletem imediatamente e sobrevivem ao recarregamento.
4. Tentar agendar sobre outro atendimento: apresentar conflito sem salvar alteração parcial.
5. Comprar 3 unidades por R$ 90: estoque aumenta 3 e caixa registra uma única saída de R$ 90. Registrar uso não cria saída adicional.
6. Com estoque 5, demanda 8 e mínimo zero: lista mostra comprar 3; cancelamento/conclusão recalcula.
7. Confirmar a mesma sugestão/comando duas vezes: somente um efeito.
8. Operar em 390 px e desktop sem rolagem horizontal da página e com controles legíveis.
9. Cadastrar custo estimado no serviço e ajustar no atendimento: preservar o histórico após editar o cadastro e não criar saída no caixa. Registrar custo efetivo pela ação própria: aumentar gasto do período uma única vez.
10. Somar demanda extra manual e ver Pomada/Mousse mesmo com estoque suficiente; exportar o mesmo período em PDF sem alterar registros.
11. Alternar o tema, recarregar e manter a escolha; sem escolha salva, usar a preferência do sistema.
12. Recolher o menu desktop e manter a escolha após recarregar; no celular, usar navegação inferior e cartões de atendimento em uma coluna.
