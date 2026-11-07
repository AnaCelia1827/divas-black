# Divas Black

Software de gestão do salão: agenda em post-its, clientes, serviços, caixa e materiais. Interface em português, responsiva, com preto e rosa forte. A primeira versão funciona sem login e usa dados fictícios; WhatsApp e assistente são simulações revisáveis.

Custos entram de duas formas: “Adicionar custo” registra uma despesa paga do salão; o cadastro de serviço e o atendimento permitem custo estimado. A estimativa fica preservada no histórico e não cria despesa automática no caixa.

A lista de compra soma a demanda da agenda ao complemento manual de cada material. Pomada e Mousse permanecem na lista mesmo com estoque suficiente; demonstrações já salvas recebem esses itens sem resetar cadastros ou quantidades existentes.

Em cada item, “Definir preço”/“Editar preço” salva o preço por unidade e mostra a compra prevista. Pomada e Mousse também permitem essa edição. Registrar compra sugere o total pela quantidade, com correção manual antes de confirmar; alterar a referência não cria despesa nem modifica o histórico. O campo também está no cadastro de material e permanece salvo no adaptador selecionado.

“Baixar PDF” exporta a lista do período diretamente no navegador, sem enviar os dados para geração externa. O aplicativo também oferece modo escuro com preferência salva e padrão inicial do sistema; no desktop, o menu lateral pode ser recolhido e mantém a escolha. No celular, os cartões de atendimento aparecem em uma coluna.

No Caixa, “Exportar planilha” baixa uma planilha financeira completa com Resumo, Movimentações, Atendimentos, A receber, Serviços, Categorias e Fluxo mensal. Caixa, categorias e meses respeitam os filtros de data, tipo e categoria; agenda e valores a receber usam todos os atendimentos das datas escolhidas. Saldos de atendimento consideram pagamentos/reembolsos acumulados de todas as datas. Custos ausentes ficam em branco, e estimativas ativas não incluem cancelamentos/ausências. O arquivo é gerado localmente, sem alterar registros ou enviar dados para conversão.

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
3. Execute `npm run build` e depois `npm run preview:supabase` em outro terminal. Essa instância força Supabase na porta 3001; `npm run dev` mantém a demonstração na porta 3000. Na primeira leitura do banco, dados fictícios são inseridos somente se ainda não houver snapshot.
4. Verifique criar um cliente, recarregar e consultar pelo segundo navegador. Registre compra/pagamento e confira os indicadores.

Nunca exponha a chave como `NEXT_PUBLIC_*`. Não envie `.env.local` ao Git. Se o banco configurado falhar, a aplicação mostra erro; não troca silenciosamente por armazenamento local.

### Duas instâncias locais

- Demonstração: `npm run dev:demo` → `http://localhost:3000`, com dados neste navegador.
- Supabase: após o build, `npm run preview:supabase` → `http://localhost:3001`, com acesso ao banco pelo servidor.

As duas instâncias usam o mesmo código. A segunda reinicia quando `.env.local` ou `.env` muda; atualize a página para tentar a nova configuração. Mudanças no código exigem novo build e reinício da prévia. Em produção, `npm start` respeita `DATA_PROVIDER` do ambiente. No celular na mesma rede, use o IP do computador no lugar de `localhost`; esse acesso depende do computador ligado e das permissões de rede do Windows.

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

A suíte automatizada cobre separação de previsto/recebido, pagamentos parciais, reembolso, conflitos de agenda, custos estimados sem impacto no caixa, snapshots históricos, demanda manual e itens fixos da lista de compra, geração de PDF, exportação financeira XLSX com fórmulas/resultados salvos e roundtrip, atualização atômica de compra/caixa, persistência, validação e concorrência. Também verifica rotas da API, carregamento e erros do hook, navegação e formulários em DOM simulado, incluindo cadastro de cliente durante o agendamento. Testes de banco usam armazenamento simulado com compare-and-swap; nenhuma conexão real é presumida. O PDF foi renderizado com PyMuPDF e inspecionado separadamente. Testes de DOM/HTTP não substituem validação visual por screenshots da interface final no navegador, que não foi realizada.

## Documentação

- [Requisitos funcionais e regras de negócio](docs/requisitos.md)
- [Contrato para API, agente e persistência](docs/integracao.md)
- [Viabilidade e custos para uma usuária no celular](docs/plano-negocios.md)

Compras são pagas no momento do registro. Consumo de material é explícito; concluir atendimento não baixa estoque nem recebe pagamento automaticamente. A receber e caixa realizado ficam separados.

Sem autenticação, esta implantação é uma demonstração com dados fictícios. Antes de usar dados reais, implementar controle de acesso com a equipe responsável pela API.
