# Divas Black

Software de gestão do salão: agenda em post-its, clientes, serviços, caixa e materiais. Interface em português, responsiva, com preto e rosa forte. A primeira versão funciona sem login e usa dados fictícios; WhatsApp e assistente são simulações revisáveis.

Custos entram de duas formas: “Adicionar custo” registra uma despesa paga do salão; o cadastro de serviço e o atendimento permitem custo estimado. A estimativa fica preservada no histórico e não cria despesa automática no caixa.

A lista de compra soma a demanda da agenda ao complemento manual de cada material. Pomada e Mousse permanecem na lista mesmo com estoque suficiente; demonstrações já salvas recebem esses itens sem resetar cadastros ou quantidades existentes.

“Baixar PDF” exporta a lista do período diretamente no navegador, sem enviar os dados para geração externa. O aplicativo também oferece modo escuro com preferência salva e padrão inicial do sistema; no desktop, o menu lateral pode ser recolhido e mantém a escolha. No celular, os cartões de atendimento aparecem em uma coluna.

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

A suíte automatizada cobre separação de previsto/recebido, pagamentos parciais, reembolso, conflitos de agenda, custos estimados sem impacto no caixa, snapshots históricos, demanda manual e itens fixos da lista de compra, geração de PDF, atualização atômica de compra/caixa, persistência, validação e concorrência. Também verifica rotas da API, carregamento e erros do hook, navegação e formulários em DOM simulado, incluindo cadastro de cliente durante o agendamento. Testes de banco usam armazenamento simulado com compare-and-swap; nenhuma conexão real é presumida. O PDF foi renderizado com PyMuPDF e inspecionado separadamente. Testes de DOM/HTTP não substituem validação visual por screenshots da interface final no navegador, que não foi realizada.

## Documentação

- [Requisitos funcionais e regras de negócio](docs/requisitos.md)
- [Contrato para API, agente e persistência](docs/integracao.md)

Compras são pagas no momento do registro. Consumo de material é explícito; concluir atendimento não baixa estoque nem recebe pagamento automaticamente. A receber e caixa realizado ficam separados.

Sem autenticação, esta implantação é uma demonstração com dados fictícios. Antes de usar dados reais, implementar controle de acesso com a equipe responsável pela API.
