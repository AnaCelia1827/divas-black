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

Tipos de comandos: `saveClient`, `saveService`, `saveAppointment`, `setAppointmentStatus`, `recordCash`, `refund`, `saveMaterial`, `recordStock`. Consulte a união discriminada em `lib/types.ts`; campos extras e valores inválidos são recusados.

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

## Assistente na interface e backend de WhatsApp

A interface apresenta um `AssistantDraft` fictício e revisável. O draft contém cliente, telefone, serviço, instante com timezone, preço, observação e mensagem de origem; confirmação registra `confirmedAppointmentId`.

O backend real de WhatsApp está no pacote independente [`integrations/whatsapp`](../integrations/whatsapp/README.md). Ele implementa `GET/POST /webhooks/whatsapp` no servidor local da porta 3001 e entrega o contrato [`IntegrationEvent` versão 1](../integrations/whatsapp/docs/CONTRATO.md) a um receptor configurado por `SOFTWARE_WEBHOOK_URL`. O receptor de teste persiste e deduplica os eventos na porta 3002. Dados, dependências e variáveis desse pacote ficam separados da aplicação Next.js; comandos `whatsapp:*` na raiz permitem operá-lo.

O formato de evento de WhatsApp não é um `Command` do aplicativo. A integração do repositório mantém os dois serviços lado a lado; não cria uma gravação pública de `AppData` nem confirmação automática de agenda. Para conectar a interface no futuro, adicionar ingestão validada de rascunhos ao repositório escolhido, incluindo revisão de ano/endereço ausentes e associação explícita de cliente e serviço. O modo demo da interface usa `localStorage`, que o servidor de WhatsApp não pode alterar diretamente.

Para a API externa, mapear a conversa para rascunho e permitir revisão. A mensagem de uma cliente dizendo que pagará não autoriza `recordCash`. Não confirmar datas ambíguas automaticamente. O emissor entrega atendimento nulo e mensagens originais quando a IA falha, com estado explícito; não simula resultado real silenciosamente.

## Persistência escolhida para o hackathon

Um snapshot tipado em JSONB na tabela `divas_demo_state` mantém cadastros, caixa, estoque e comandos aplicados juntos. A RPC `divas_save_demo` troca o snapshot somente quando `revision` coincide. Em conflito, o servidor relê e reaplica o comando; isso evita perder alterações de duas abas/usuárias e evita pagamento ou compra parcial.

Esta é uma arquitetura deliberada para o MVP de um único salão, não uma modelagem analítica definitiva. Na evolução, migrar coleções para tabelas normalizadas e comandos para transações de banco, preservando o contrato. Antes de dados reais, adicionar autenticação, autorização por salão e trilha de auditoria.

RLS bloqueia `anon` e `authenticated`; somente o servidor usa chave secret/service_role. A API da aplicação continua sem autenticação por pedido do MVP: qualquer visitante autorizado a acessar a demonstração pode ler e alterar dados fictícios. Guardar o segredo no servidor não transforma a API pública em sistema para dados pessoais reais.

## Verificação realizada

Testes de domínio, armazenamento local e concorrência usam memória/mock. Eles não validam uma instância real do Supabase nem a aplicação da migração. A conexão real exige configurar projeto, SQL e variáveis e executar o fluxo de aceite no ambiente conectado.
