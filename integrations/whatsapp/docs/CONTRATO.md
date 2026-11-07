# Contrato WhatsApp → software, versão 1

`POST /integrations/whatsapp/events`

Headers: `Content-Type: application/json`, `Authorization: Bearer <token>` e `Idempotency-Key: <event_id>`.

O [JSON Schema](event.schema.json) é a referência executável; é gerado pelo mesmo Zod usado no receptor.

| Campo | Significado |
|---|---|
| `schema_version` | Inteiro fixo `1` |
| `event_id` | UUID estável durante retentativas |
| `conversation_id` | `phone_number_id:wa_id` |
| `revision` | Inteiro positivo crescente por conversa; versão do pacote, não ID do atendimento |
| `phone_number_id` | Identificador do número empresarial na Meta |
| `contact` | `wa_id` e `profile_name` do **remetente**; não identificam automaticamente a cliente |
| `messages` | Mensagens originais normalizadas, ordenadas por horário; inclui mensagens novas e a janela recente |
| `atendimento` | Sugestão estruturada ou `null`; nunca uma confirmação de agenda |
| `evidencias` | Lista de `{ campo, message_ids }`, vinculando campos às mensagens fornecidas à IA |
| `extraction_status` | `completed` ou `failed`; completed pode ter atendimento nulo quando a conversa não trata de atendimento |
| `extraction_error` | Código de falha, sem corpo da resposta externa; `null` quando concluída |
| `context_truncated` | Indica histórico fora da janela ou corte por limite de caracteres |
| `context_message_ids` | IDs das mensagens consideradas na extração; texto longo pode ter sido parcialmente cortado |
| `requires_review` | Sempre `true` |
| `generated_at` | Data/hora UTC ISO 8601 |

Cada mensagem tem `id`, `phone_number_id`, `conversation_id`, `sender`, `direction: "inbound"`, `timestamp`, `received_at`, `type`, `text`, `reply_to_message_id`, `forwarded` e `metadata`. `text` preserva o original; áudio/imagem/documento usam texto nulo e somente metadados. `timestamp` é o horário original; `received_at` é o horário de recepção. Ambos usam UTC.

## Atendimento

```json
{
  "cliente": { "nome": "Maria", "telefone": null },
  "data_informada": "07/11",
  "data_atendimento": null,
  "hora_atendimento": "16:00",
  "fuso_horario": "America/Sao_Paulo",
  "localizacao": { "tipo": "salao", "descricao": "No salão", "endereco": null },
  "servico": "Tranças boxeadoras",
  "requer_revisao": true,
  "pendencias": ["Confirmar o ano do atendimento", "Vincular o endereço cadastrado do salão"]
}
```

Datas completas usam `AAAA-MM-DD`, horários `HH:mm`. Não completar `07/11` com o ano da recepção. Datas relativas usam o timestamp original no fuso de São Paulo. Localização admite `salao`, `domicilio`, `outro` e `nao_informado`. `SALON_ADDRESS` pode enriquecer um local reconhecido como salão; não é enviado à IA.

Os campos de evidência são `cliente.nome`, `cliente.telefone`, `data_informada`, `data_atendimento`, `hora_atendimento`, `localizacao` e `servico`. O telefone da cliente somente pode vir de número explicitamente mencionado no texto; o telefone de transporte fica separado em `contact`.

Mensagens são dados não confiáveis; a IA pode errar. Mesmo com evidências e validação estrutural, o software deve mostrar a sugestão para revisão humana antes de produzir efeitos. Uma promessa de pagamento não é um pagamento; esta versão não extrai nem movimenta valores financeiros.

## Processamento no receptor

1. Autenticar e validar o JSON.
2. Em uma transação, deduplicar por `event_id` e registrar o recebimento.
3. Atualizar a sugestão da conversa apenas se `revision` for maior que a última aplicada. Uma nova revisão substitui a sugestão dessa conversa; não criar um atendimento novo automaticamente por evento.
4. Responder `2xx` apenas após persistir, inclusive para duplicatas/revisões antigas válidas. Caso contrário, devolver erro.

É possível receber revisão antiga após uma mais recente por causa das retentativas. Conservar mensagens por ID caso o software mantenha seu próprio histórico. O pacote usa janelas de contexto, não repete todo o histórico indefinidamente.

Timeout, `429` e `5xx` são transitórios; outros status exigem correção. Não há seguimento de redirects. O receptor local incluído implementa essas regras de idempotência e possui `GET` autenticado para inspeção; esse `GET` não é obrigatório no software final.
