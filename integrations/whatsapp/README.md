# Divas Black — integração WhatsApp

API local, sem interface: **WhatsApp → webhook assinado → SQLite → extração por IA → JSON enviado ao software**.

Este pacote está integrado ao repositório do aplicativo Next.js em `integrations/whatsapp`. Os comandos abaixo devem ser executados **neste diretório**. A partir da raiz, use os atalhos `npm.cmd run whatsapp:start`, `whatsapp:receiver`, `whatsapp:demo`, `whatsapp:test`, `whatsapp:typecheck` e `whatsapp:build`. O aplicativo mantém seus comandos `dev`, `start`, `build` e `test` na raiz.

Extrai nome da cliente, data, horário, localização e serviço. Cada resultado requer revisão humana. Não confirma atendimentos, pagamentos ou movimentações de estoque.

## Requisitos

- Node.js **24.15 ou superior da linha 24**, npm e acesso à internet para instalar dependências/consultar a OpenAI.
- Chave válida da OpenAI com acesso a `gpt-5.4-mini`.
- Para mensagens reais: aplicativo Meta com WhatsApp, WABA, número de teste e ngrok configurados na sua conta.

No Windows, use `npm.cmd`: evita a restrição do PowerShell sobre `npm.ps1`.

## Demonstração local

```powershell
npm.cmd ci
npm.cmd run setup:demo
```

O segundo comando cria `.env` **apenas se o arquivo não existir**, com segredos aleatórios para a demonstração local. Esse App Secret é fictício e não conecta uma conta Meta. Sua chave real da OpenAI não é gravada nem exibida pelo script.

Configure `OPENAI_API_KEY` no ambiente ou em `.env`. Variáveis já existentes no ambiente prevalecem sobre `.env`. Não compartilhe esse arquivo nem faça commit dele. `SALON_ADDRESS` pode conter o endereço real do salão; vazio deixa uma pendência de revisão.

Em dois terminais separados:

```powershell
# Terminal 1: software receptor de teste
npm.cmd run receiver
```

```powershell
# Terminal 2: integração
npm.cmd start
```

Em um terceiro terminal:

```powershell
npm.cmd run demo
```

O script envia a mensagem **fictícia** de Maria ao webhook com assinatura HMAC válida, aguarda o agrupamento de cinco segundos, e mostra o JSON observado no receptor local. Em outro software receptor use `npm.cmd run demo -- --no-wait`. A API não faz fallback para IA simulada: erro da IA gera `extraction_status: "failed"` com `atendimento: null`, preservando as mensagens.

Você também pode verificar apenas a chamada real de IA:

```powershell
npm.cmd run test:live
```

Esse teste envia somente a mensagem fictícia e verifica Maria, 16:00, ano não informado, telefone não atribuído ao remetente e serviço "Tranças boxeadoras". **Consome a API real.** `npm.cmd test` usa respostas controladas e não consome IA.

## Conectar o número de teste da Meta

1. No painel de desenvolvedores da Meta, prepare o aplicativo com WhatsApp e localize a WABA, o número de teste e seu `phone_number_id`.
2. Em `.env`, substitua `META_APP_SECRET` pelo **App Secret real** e configure `WHATSAPP_PHONE_NUMBER_ID`. Escolha `WHATSAPP_VERIFY_TOKEN` e guarde o mesmo valor para a configuração do webhook. App Secret, verify token e access token são credenciais diferentes.
3. Reinicie a API. Instale/autentique o [ngrok oficial](https://ngrok.com/docs/getting-started/) e inicie:

   ```powershell
   ngrok http http://127.0.0.1:3001
   ```

4. Cadastre na Meta a URL `https://<dominio-ngrok>/webhooks/whatsapp`, o verify token e a assinatura do campo **messages**. O túnel fica ativo enquanto ngrok e o computador estiverem ligados.
5. Confirme também a associação do aplicativo à WABA. Se necessário, use a operação **Subscribe to your WABA** da [coleção oficial da Meta](https://www.postman.com/meta/whatsapp-business-platform/overview): `POST /<WABA_ID>/subscribed_apps` na versão Graph indicada no seu painel, com access token e permissões apropriadas. Não é necessário gravar esse access token no servidor receptor.
6. Envie uma mensagem de texto ao número de teste e consulte o receptor. Para demonstrar a confirmação de Maria, encaminhe o texto ao número de teste.

O número de teste **não lê o histórico ou as respostas do WhatsApp atual de Carina**. Captar ambos os lados no número atual exige uma integração posterior com coexistência elegível. Este projeto só recebe novas mensagens e notificações no número conectado; não envia respostas no WhatsApp.

## Conectar o software em desenvolvimento

Configure:

```dotenv
SOFTWARE_WEBHOOK_URL=https://seu-software.example/integrations/whatsapp/events
SOFTWARE_API_TOKEN=<token-combinado-entre-os-servidores>
```

HTTP é permitido apenas para endereço local; no destino remoto é exigido HTTPS. Tokens não são encaminhados em redirecionamentos. A integração usa `Authorization: Bearer ...` e `Idempotency-Key: <event_id>`.

Implemente o [contrato de integração](docs/CONTRATO.md), disponível também como [JSON Schema](docs/event.schema.json). O receptor incluído demonstra persistência, autenticação, deduplicação e rejeição de revisões antigas. Ele **não implementa o sistema de agenda**. `GET /integrations/whatsapp/events`, com o mesmo Bearer, retorna o último pacote de cada conversa apenas no receptor de demonstração.

## Filas, falhas e recuperação

- Webhook é reconhecido com `200` **depois** da transação SQLite. Falha de armazenamento retorna `503`. Duplicatas não geram nova extração nem estendem o agrupamento.
- Cada conversa usa `phone_number_id:wa_id`; notificações de entrega/leitura ficam em tabela separada.
- A IA recebe até 100 mensagens recentes e 20 mil caracteres. O pacote entrega as mensagens da janela e **todas as mensagens novas**, mesmo que o contexto da IA precise ser cortado. `context_truncated` e `context_message_ids` permitem identificar esse recorte.
- A resposta da IA é validada. Só são aceitas referências a mensagens presentes no contexto. Ano ausente não é preenchido com o ano atual. Serviço sem correspondência no texto é deixado pendente.
- Falha da IA: enviar originais e estado `failed`; corrigir a chave não altera pacotes já entregues. A próxima mensagem gera outra extração com o contexto recente.
- A fila de saída é persistida antes do envio. Timeout, `429` e `5xx` repetem após **5, 30 e 120 segundos**, com o mesmo `event_id` (quatro tentativas no total). Outros códigos ficam em falha para correção. Timeout por entrega: 10 segundos; IA: 30 segundos.
- Um reinício preserva mensagens não processadas e pacotes pendentes. O receptor precisa deduplicar: uma falha depois do recebimento remoto pode causar reentrega.

```powershell
# Ver estados sem imprimir mensagens ou credenciais
npm.cmd run replay -- --list

# Recolocar todas as entregas em estado failed na fila
npm.cmd run replay -- --all

# Ou somente um evento
npm.cmd run replay -- <event_id>
```

A API precisa estar ativa para consumir novamente a fila. Esse comando reenvia o JSON persistido; não chama a IA novamente. Execute apenas **uma instância da API por arquivo SQLite**.

## Desenvolvimento e verificação

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd run schema
```

`npm.cmd run dev` reinicia a API ao editar arquivos. `npm.cmd run start:built` executa o servidor compilado em `dist/`. O comando `schema` atualiza o contrato a partir dos validadores usados no receptor.

Os testes cobrem assinatura, verificação do webhook, múltiplas mensagens/contatos, mídia, dados faltantes, origem dos campos, persistência após reinício, mensagens durante extração, falhas de IA, retentativas, idempotência e o fluxo HTTP completo com um extrator controlado.

## Configuração e armazenamento

Veja [`.env.example`](.env.example). Sem App Secret, verify token ou token do software, a API falha na inicialização com orientação de configuração. Sem chave da IA ela pode receber e entregar as mensagens com falha de extração identificada.

Os bancos ficam em `data/`, excluídos do Git; contêm dados pessoais em texto local, sem criptografia própria nem expiração automática. Use somente dados fictícios na demonstração. Retenção, exclusão, backups e operação permanente devem ser definidos antes de usar dados reais. O servidor não registra corpos de conversas, tokens ou respostas brutas de serviços externos nos logs.

Custos e hipóteses estão em [CUSTOS.md](docs/CUSTOS.md). A entrega não publica serviços, cria contas, contrata planos ou configura credenciais Meta automaticamente.
