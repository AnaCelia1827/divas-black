# Cotação de planejamento

Referência consultada em **07/11/2026**. Valores ilustrativos, sem compra ou contratação. Conversão hipotética **US$ 1 = R$ 6**, não cotação cambial atual.

## Consumo local

Premissa por **extração**, não por mensagem nem atendimento: 2.000 tokens de entrada e 500 de saída. Mensagens agrupadas podem gerar uma extração, e mensagens posteriores podem gerar novas revisões da mesma conversa.

GPT-5.4 Mini: US$ 0,75/milhão de tokens de entrada e US$ 4,50/milhão de saída. A chamada usa reasoning `none` e não usa ferramentas extras. [Preço oficial](https://developers.openai.com/api/docs/models/gpt-5.4-mini).

`custo = (extrações × tokens_entrada ÷ 1.000.000 × 0,75) + (extrações × tokens_saida ÷ 1.000.000 × 4,50)`

| Item | Demonstração: 100 extrações | Uso local: 1.000 extrações/mês |
|---|---:|---:|
| Servidor e SQLite no computador | R$ 0 adicional | R$ 0 adicional |
| ngrok Free dentro dos limites | R$ 0 | R$ 0 |
| WhatsApp: recepção direta, sem envio ou intermediário | R$ 0 de mensagens de saída | R$ 0 de mensagens de saída |
| IA | US$ 0,375 ≈ **R$ 2,25** | US$ 3,75 ≈ **R$ 22,50** |
| **Serviços externos estimados** | **R$ 2,25** | **R$ 22,50/mês** |

O [ngrok Free](https://ngrok.com/pricing) tem limites de uso, transferência e requisições. A [Meta descreve cobrança por mensagens entregues aos usuários](https://business.whatsapp.com/products/platform-pricing); este projeto recebe mensagens e não envia mensagens pelo WhatsApp. Integração direta não inclui taxas de intermediários.

Os valores dependem do consumo real, número de revisões e tamanho de contexto. Não incluem internet/energia já existentes, tributos, câmbio efetivo, taxas de pagamento, manutenção, excedentes nem hospedagem do software receptor. O máximo de saída configurado é maior que a média orçada para comportar evidências; isso não representa consumo fixo.

## Desenvolvimento e evolução

**Simulação, não proposta comercial de fornecedor:** 1 hora × R$ 100/h = **R$ 100**. Desenvolvimento mais 100 extrações, dentro das hipóteses: **R$ 102,25**.

A hora é meta para um MVP com credenciais e conectividade disponíveis; aprovações/configuração da Meta podem levar mais tempo.

Hospedagem permanente fica fora da entrega. [Cloudflare Workers](https://developers.cloudflare.com/workers/platform/pricing/) tem plano pago a partir de US$ 5/mês (R$ 30 na conversão hipotética), mas requer adaptar este servidor local, definir persistência, backups e os demais custos da operação. Esse preço isolado não é orçamento completo de produção.
