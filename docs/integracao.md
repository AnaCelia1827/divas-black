# Integração com a API e o agente

## Separação de responsabilidades

O frontend usa `AppRepository` (`load()` e `execute(command)`) de `lib/types.ts`. O domínio puro aplica os mesmos comandos no modo local e no banco. A outra pessoa pode substituir o adaptador pela API externa mantendo os tipos, as regras e os componentes.

- `lib/domain.ts`: agenda, conflitos, pagamentos, caixa, estoque e lista de compra.
- `lib/validation.ts`: entrada desconhecida é validada antes de executar; não confiar nos dados recebidos do agente.
- `lib/repository.ts`: demonstração persistida no `localStorage`, versão de schema 1. Criar o repositório não acessa APIs de browser no SSR.
- `lib/server-repository.ts`: adaptador Supabase exclusivo do servidor.
- `lib/versioned-repository.ts`: leitura, aplicação e atualização otimista atômica com até 8 tentativas.

## API disponível

`GET /api/data` responde `{ mode: "demo", data: null }` ou `{ mode: "supabase", data: AppData }`. Não há cache de dados financeiros.

`POST /api/data` aceita um `Command` e responde `{ data: AppData }`. No modo local, o browser usa diretamente o repositório de demonstração e o POST é recusado. Erros retornam `{ error: string }`, com status apropriado; nunca tratar falha de persistência como sucesso.

Tipos de comandos: `saveClient`, `saveService`, `saveAppointment`, `setAppointmentStatus`, `recordCash`, `refund`, `saveMaterial`, `recordStock`, `saveTextDraft`, `confirmTextDraft`. Consulte a união discriminada em `lib/types.ts`; campos extras e valores inválidos são recusados.

`Service.costCents` e `Appointment.costCents` são custos estimados opcionais, em centavos inteiros não negativos. O atendimento copia o custo do serviço ao ser criado e preserva seu valor ao remarcar; custo explícito enviado pelo formulário prevalece. Alterar custo no cadastro do serviço não reescreve snapshots anteriores. Dados antigos sem esses campos continuam válidos no schema 1, sem migração SQL. Estimativas não produzem `CashMovement`: a ação “Adicionar custo” registra despesa paga com `recordCash`, direção `out`, enquanto uma compra paga usa `recordStock` e cria sua saída automaticamente.

`Material.manualDemand?: number` acrescenta quantidade não negativa à demanda da agenda; é salva por `saveMaterial`, sem alterar o saldo físico. `alwaysOnShoppingList?: boolean` mantém um material na lista mesmo quando `shortage` é zero. `getShoppingList` mantém o contrato `{ material, demand, shortage }`; `demand` já contém agenda mais complemento manual. Pomada/Mousse são normalizados em `lib/fixed-materials.ts` na criação do seed e leitura de snapshots antigos, sem apagar dados. Cadastros existentes de mesmo nome são reutilizados, mantendo quantidade/unidade/mínimo. A normalização aparece no carregamento e fica gravada no snapshot ao próximo comando; não exige migração SQL.

Exemplo de recebimento, valores em centavos:

```json
{
  "commandId": "payment-event-unique-id",
  "type": "recordCash",
  "movement": {
    "id": "cash-unique-id",
    "direction": "in",
    "amountCents": 5000,
    "date": "2026-11-07",
    "category": "Serviços",
    "description": "Sinal confirmado pela Carina",
    "appointmentId": "appointment-id"
  }
}
```

Use o mesmo `commandId` ao repetir uma requisição cujo resultado se perdeu. O ID é armazenado na mesma transação do efeito. IDs de lançamentos não podem ser reutilizados com outro comando. Para novos eventos, gere IDs novos.

## Assistente por texto

`POST /api/assistant/extract` aceita `{ "message": "texto do atendimento" }` e responde `{ "extraction": TextExtraction }`. Limite de 4.000 caracteres e 24 KB no corpo lido, verificação de origem, timeout de 30 segundos na Groq e resposta sem cache. Configuração exclusiva do servidor: `GROQ_API_KEY` e `GROQ_MODEL` (padrão `openai/gpt-oss-20b`). Não depende de API do WhatsApp, número, webhook, túnel nem servidor Express separado.

`TextExtraction` em `lib/text-draft.ts` contém `clientName`, `dateText`, `date` (`AAAA-MM-DD`), `time` (`HH:mm`), `location`, `serviceName`, `totalCents`, `depositCents`, `finalCents` e `warnings`. Campos ausentes são `null`; valores monetários são centavos inteiros. A saída estruturada da Groq inclui trechos literais de evidência, conferidos no servidor antes da resposta. Não supõe ano, horário, endereço, parcelas ausentes ou equivalência entre procedimentos. Evidências inválidas deixam o campo nulo e acrescentam pendência. Falha da IA retorna erro explícito; não simula extração.

`saveTextDraft` grava um `AssistantDraft` com mensagem original e `extraction`, sem criar cadastros, atendimento ou caixa. `startAt` vazio é permitido nesse rascunho incompleto; o timestamp de atendimento continua obrigatório. O mesmo `commandId` é reutilizado após falha de gravação. Os rascunhos antigos de demonstração continuam compatíveis.

`confirmTextDraft` recebe `draftId`, `client`, `service`, `appointment` e `review`. A revisão exige nome/data/horário/local/serviço/total e confere a soma quando entrada e final estão presentes. Cria somente cadastros inexistentes, preservando os existentes, verifica conflitos e salva tudo no mesmo snapshot; a falha não grava cadastros parciais. Grava `reviewed` e `confirmedAppointmentId`, preservando mensagem e extração originais. Local, procedimento mencionado e condições de pagamento ficam também nas observações do atendimento. A mensagem pode ter 4.000 caracteres; a cópia nas observações tem o limite de 2.000, com original integral no rascunho. Nenhuma confirmação cria `CashMovement`. O recebimento usa a ação explícita de caixa existente.

## Exportação e preferências locais

`lib/shopping-pdf.ts` gera o PDF no navegador a partir de `AppData`, início e fim do período, usando o mesmo `getShoppingList`. A geração não chama serviço externo, não cria comandos e não modifica estoque ou caixa. O arquivo usa tabela com estoque, demanda total e quantidade a comprar, incluindo fixos com falta zero.

`lib/financial-xlsx.ts` exporta `buildFinancialWorkbook(data, filters, now?)`, `generateFinancialSpreadsheet(...)` e `downloadFinancialSpreadsheet(...)`. `FinancialExportFilters` contém `from`, `to`, `direction?: 'all' | 'in' | 'out'`, `category?: string` e `mode?: 'demo' | 'supabase'`; categoria vazia/omitida ou `all` significa todas. A implementação usa o workbook documental do ExcelJS, compatível com browser, carregado quando a usuária solicita a exportação. O download usa Blob local, sem endpoint, upload ou gravação do estado do salão.

O XLSX contém Resumo, Movimentações, Atendimentos, A receber, Serviços, Categorias e Fluxo mensal. As três visões de caixa filtram data/tipo/categoria antes de calcular; agenda filtra apenas datas de atendimento em São Paulo. Recebimento acumulado inclui todas as datas e reembolsos; não representa posição histórica do último dia do filtro. Saldos cancelados/ausências ficam zerados e estimativas de serviços/resumo consideram somente ativos. Custo ausente fica em branco com indicação de ausência, distinguindo zero legítimo. Colunas de entradas/reembolsos acumulados explicam a composição do saldo, e IDs ficam no fim das abas de origem.

Valores são centavos convertidos em números de moeda, datas são células de data e horas são frações de dia com formato de horário. Fórmulas em inglês têm resultados calculados em JavaScript a partir dos centavos e a opção de recálculo ao abrir. Textos iniciados por `=` continuam strings literais. Testes fazem roundtrip do arquivo XLSX, conferindo os resultados salvos; isso não substitui recálculo independente na aplicação nativa.

Tema claro/escuro e menu lateral recolhido são preferências de apresentação salvas no navegador, fora do snapshot operacional e do contrato de comandos. Sem tema explícito salvo, a interface segue `prefers-color-scheme`. Esses estados não exigem novos endpoints nem mudanças no banco. A navegação inferior substitui o menu lateral no celular.

## Persistência escolhida para o hackathon

`Material.unitPriceCents?: number` é o preço de referência por unidade, em centavos. O comando `saveMaterial` existente salva/limpa esse campo nos dois adaptadores, sem migração SQL adicional no snapshot JSONB. Ausente significa não informado e zero é válido. `getShoppingList` retorna também `estimatedCostCents?: number`, calculado com a quantidade faltante. O total pago em `recordStock` continua independente: mudar o preço não reescreve compras ou movimentos do caixa. A previsão aparece na interface; o PDF atual conserva seu formato de quantidades.

Um snapshot tipado em JSONB na tabela `divas_demo_state` mantém cadastros, caixa, estoque e comandos aplicados juntos. A RPC `divas_save_demo` troca o snapshot somente quando `revision` coincide. Em conflito, o servidor relê e reaplica o comando; isso evita perder alterações de duas abas/usuárias e evita pagamento ou compra parcial.

Esta é uma arquitetura deliberada para o MVP de um único salão, não uma modelagem analítica definitiva. Na evolução, migrar coleções para tabelas normalizadas e comandos para transações de banco, preservando o contrato. Antes de dados reais, adicionar autenticação, autorização por salão e trilha de auditoria.

RLS bloqueia `anon` e `authenticated`; somente o servidor usa chave secret/service_role. A API da aplicação continua sem autenticação por pedido do MVP: qualquer visitante autorizado a acessar a demonstração pode ler e alterar dados fictícios. Guardar o segredo no servidor não transforma a API pública em sistema para dados pessoais reais.

## Verificação realizada

Testes de domínio, armazenamento local e concorrência usam memória/mock. Eles não validam uma instância real do Supabase nem a aplicação da migração. A conexão real exige configurar projeto, SQL e variáveis e executar o fluxo de aceite no ambiente conectado.

A suíte automatizada inclui geração de PDF, extração de texto com evidências, validação de campos e valores, confirmação atômica, idempotência e testes de interface em DOM simulado. O assistente por texto foi também testado no Chrome com a Groq real e dados fictícios: o exemplo de Maria gerou 07/11/2026, local salão, trança boxeadora, total/entrada/final de 20000/8000/12000 centavos e horário pendente. Após completar o horário, o atendimento foi confirmado e persistiu ao recarregar, sem alteração do caixa. Screenshots desta tela foram inspecionados em 1440 px e 390 px, sem overflow horizontal. Isso não valida todas as telas, um banco real nem uma implantação de produção. O PDF foi renderizado e inspecionado em etapa anterior.
