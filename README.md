# Divas Black

Software de gestão do salão: agenda em post-its, clientes, serviços, caixa e materiais. Interface em português, responsiva, com preto e rosa forte. A primeira versão funciona sem login e usa dados fictícios. A assistente na interface usa rascunhos demonstrativos revisáveis; o backend real de WhatsApp está em `integrations/whatsapp`.

Custos entram de duas formas: “Adicionar custo” registra uma despesa paga do salão; o cadastro de serviço e o atendimento permitem custo estimado. A estimativa fica preservada no histórico e não cria despesa automática no caixa.

A lista de compra soma a demanda da agenda ao complemento manual de cada material. Pomada e Mousse permanecem na lista mesmo com estoque suficiente; demonstrações já salvas recebem esses itens sem resetar cadastros ou quantidades existentes.

## Executar

Requer Node.js 24.15 ou superior na linha 24 LTS. O projeto está configurado para Node.js 24 na Vercel.

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`. No Windows/PowerShell com scripts bloqueados, use `npm.cmd` no lugar de `npm`.

O modo padrão salva no navegador e funciona sem conta, credenciais ou configuração de banco. Os dados de exemplo são gerados relativamente à data local do primeiro uso e depois preservados. A demonstração local não sincroniza entre dispositivos.

## Banco compartilhado: Supabase

1. Crie um projeto Supabase e execute `supabase/migrations/001_demo_state.sql` no SQL Editor.
2. Copie `.env.example` para `.env.local` e preencha `SUPABASE_URL` e `SUPABASE_SECRET_KEY` com a chave secret do projeto ou a chave service_role legada.
3. Defina `DATA_PROVIDER=supabase` e reinicie o servidor. Na primeira leitura, dados fictícios são inseridos somente se ainda não houver snapshot.
4. Verifique criar um cliente, recarregar e consultar pelo segundo navegador. Registre compra/pagamento e confira os indicadores.

Nunca exponha a chave como `NEXT_PUBLIC_*`. Não envie `.env.local` ao Git. Se o banco configurado falhar, a aplicação mostra erro; não troca silenciosamente por armazenamento local.

## API de WhatsApp

O aplicativo Next.js fica na raiz (porta 3000). O módulo independente em [`integrations/whatsapp`](integrations/whatsapp/README.md) recebe webhooks da Meta (porta 3001), persiste mensagens em SQLite, extrai cliente/data/horário/local/serviço pela API da **Groq** e envia JSON para um receptor configurável. O receptor de teste usa a porta 3002.

```bash
npm run whatsapp:install
npm run whatsapp:setup
# Execute cada um dos próximos comandos em um terminal separado:
npm run whatsapp:receiver
npm run whatsapp:start
# Depois envie o exemplo fictício:
npm run whatsapp:demo
```

Configure as credenciais reais somente em `integrations/whatsapp/.env`, conforme o [guia do módulo](integrations/whatsapp/README.md). A extração usa `GROQ_API_KEY` e `GROQ_MODEL=openai/gpt-oss-20b`; teste a chave com `npm run whatsapp:test:live`. A configuração do aplicativo continua em `.env.local`, na raiz. O banco SQLite da integração é local e não deve ser usado como armazenamento persistente em um deploy Vercel.

O [contrato de eventos](integrations/whatsapp/docs/CONTRATO.md) entrega sugestões revisáveis; o [JSON Schema](integrations/whatsapp/docs/event.schema.json) valida o pacote. `SOFTWARE_WEBHOOK_URL` aponta inicialmente para o receptor de teste. A interface Next.js ainda não ingere esses eventos: não aponte o emissor diretamente para `/api/data`, que aceita comandos do domínio, não pacotes de conversa. Essa separação preserva as regras de confirmação manual, caixa e estoque do aplicativo.

Para verificar o módulo a partir da raiz:

```bash
npm run whatsapp:typecheck
npm run whatsapp:test
npm run whatsapp:build
```

A [cotação de planejamento](integrations/whatsapp/docs/CUSTOS.md) separa consumo de IA, infraestrutura e hipótese de desenvolvimento.

## Deploy na Vercel

1. Suba o repositório para o Git e importe na Vercel como projeto Next.js.
2. Use build `npm run build`; não configure exportação estática nem diretório de saída personalizado.
3. Para demonstração local, mantenha `DATA_PROVIDER=demo` ou não defina variáveis. Para banco compartilhado, configure `DATA_PROVIDER=supabase`, `SUPABASE_URL` e `SUPABASE_SECRET_KEY` nas variáveis do projeto, com o SQL já aplicado.
4. Faça deploy e valide agenda, cadastros, pagamento parcial, lista de compra e recarregamento no endereço `*.vercel.app`.

Preparado para deploy não significa publicado. Credenciais, aplicação do SQL e teste real no Supabase dependem do ambiente conectado. Não usar SQLite ou arquivo JSON local como banco persistente na Vercel.

## Verificar

```bash
npm run typecheck
npm test
npm run build
```

Os testes cobrem separação de previsto/recebido, pagamentos parciais, reembolso, conflitos de agenda, custos estimados sem impacto no caixa, snapshots históricos, lista de compra, atualização atômica de compra/caixa, persistência, validação e concorrência. A suíte também verifica rotas da API, carregamento e erros do hook, navegação e formulários em DOM simulado, incluindo cadastro de cliente durante o agendamento. Testes de banco usam um armazenamento simulado com compare-and-swap; nenhuma conexão real é presumida. Testes de DOM/HTTP não substituem validação visual por screenshots da interface final.

## Documentação

- [Requisitos funcionais e regras de negócio](docs/requisitos.md)
- [Contrato para API, agente e persistência](docs/integracao.md)

Compras são pagas no momento do registro. Consumo de material é explícito; concluir atendimento não baixa estoque nem recebe pagamento automaticamente. A receber e caixa realizado ficam separados.

Sem autenticação, esta implantação é uma demonstração com dados fictícios. Antes de usar dados reais, implementar controle de acesso com a equipe responsável pela API.
