# Divas Black

Software de gestão do salão: agenda em post-its, clientes, serviços, caixa e materiais. Interface em português, responsiva, com preto e rosa forte. A demonstração funciona sem login e inicia com dados fictícios. O assistente analisa mensagens coladas no software pela IA da Groq e gera rascunhos revisáveis.

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

O modo padrão salva no navegador e funciona sem conta, credenciais ou configuração de banco. A análise de texto por IA requer a chave descrita abaixo. Os dados de exemplo são gerados relativamente à data local do primeiro uso e depois preservados. A demonstração local não sincroniza entre dispositivos.

## Assistente por mensagem de texto

1. Configure `GROQ_API_KEY` em `.env.local`, na raiz. `GROQ_MODEL=openai/gpt-oss-20b` é o padrão. A chave fica somente no servidor, sem prefixo `NEXT_PUBLIC_`. Reinicie o servidor depois de configurar.
2. Abra **Assistente**, cole a mensagem ou toque em **Usar exemplo** e depois **Organizar mensagem**. O texto é enviado à Groq para análise; não é necessário configurar Meta, webhook ou outro número.
3. Confira cliente, data, horário, local, serviço, total, entrada e valor final. Campos ausentes ficam vazios; datas sem ano não são completadas automaticamente. Escolha cadastros existentes ou crie cliente/serviço na confirmação, preservando o procedimento mencionado.
4. Complete o horário e revise a duração antes de **Confirmar atendimento na agenda**. O exemplo de Maria informa R$ 200 de total, R$ 80 de entrada e R$ 120 no final, mas não informa horário. A duração inicial de 60 minutos para um serviço novo é editável e precisa ser conferida.

O texto original e a extração ficam salvos como rascunho no mesmo armazenamento do aplicativo. A confirmação salva cliente/serviço novos e atendimento de forma atômica; conflitos de agenda preservam o rascunho sem cadastros parciais. Entrada e valor final são condições combinadas, sem lançamentos automáticos no caixa. Registre o recebimento quando acontecer. Se a IA falhar, o texto permanece no campo; se somente a gravação falhar, tente salvar o mesmo rascunho sem outra análise.

A chamada usa [saída estruturada da Groq](https://console.groq.com/docs/structured-outputs), validada no servidor, com limite de 4.000 caracteres e tempo limite. O software ainda contém rascunhos fictícios identificados como demonstração. A aplicação continua sem autenticação; configure controle de acesso antes de expor dados reais e consumo de IA publicamente.

## Banco compartilhado: Supabase

1. Crie um projeto Supabase e execute `supabase/migrations/001_demo_state.sql` no SQL Editor.
2. Copie `.env.example` para `.env.local` e preencha `SUPABASE_URL` e `SUPABASE_SECRET_KEY` com a chave secret do projeto ou a chave service_role legada.
3. Execute `npm run build` e depois `npm run preview:supabase` em outro terminal. Essa instância força Supabase na porta 3001; `npm run dev` mantém a demonstração na porta 3000. Na primeira leitura do banco, dados fictícios são inseridos somente se ainda não houver snapshot.
4. Verifique criar um cliente, recarregar e consultar pelo segundo navegador. Registre compra/pagamento e confira os indicadores.

Nunca exponha a chave como `NEXT_PUBLIC_*`. Não envie `.env.local` ao Git. Se o banco configurado falhar, a aplicação mostra erro; não troca silenciosamente por armazenamento local.

Use `npm run check:supabase` para verificar a configuração atual, consultar a tabela e checar a permissão da função de gravação sem modificar registros. O diagnóstico exibe apenas o tipo da chave, status e código de erro; nunca o segredo ou os dados do salão. A chave Publishable não acessa a tabela privada deste projeto. Corrija `SUPABASE_SECRET_KEY` no arquivo `.env.local` da raiz, usando uma chave Secret do mesmo projeto de `SUPABASE_URL`.

As skills oficiais `supabase` e `supabase-postgres-best-practices` estão instaladas em `.agents/skills`, com origem registrada em `skills-lock.json`, usando `npx skills add supabase/agent-skills --agent codex --yes`. Elas fornecem instruções para o agente; não concedem credenciais nem autenticam a aplicação. [Repositório oficial](https://github.com/supabase/agent-skills).

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

A suíte automatizada cobre separação de previsto/recebido, pagamentos parciais, reembolso, conflitos de agenda, custos estimados sem impacto no caixa, snapshots históricos, demanda manual e itens fixos da lista de compra, geração de PDF, exportação financeira XLSX com fórmulas/resultados salvos e roundtrip, atualização atômica de compra/caixa, persistência, validação e concorrência. Também verifica rotas da API, carregamento e erros do hook, navegação e formulários em DOM simulado, incluindo extração por texto, campos ausentes, soma de parcelas, falhas da IA e confirmação atômica sem recebimento automático. Testes de banco usam armazenamento simulado com compare-and-swap; nenhuma conexão real é presumida. O PDF foi renderizado e inspecionado em etapa anterior. O assistente por texto também foi validado no Chrome com a Groq real: exemplo de Maria, horário pendente, confirmação e persistência após recarregar, sem lançamento no caixa. A tela foi inspecionada em 1440 px e 390 px, sem rolagem horizontal no celular. Isso não valida todas as outras telas nem uma implantação de produção.

## Documentação

### Pitch

A versão atual é `output/presentations/Divas-Black-Pitch-Claro.pptx`, com o estilo do `Pitch.pdf` adaptado para fundo branco: títulos centralizados, destaques rosa, tipografia Inter e faixa colorida no rodapé. Segue os critérios da foto: diagnóstico 25 pontos, funcionalidade 25, co-criação 20, adoção 20 e clareza 10. São cinco slides para quatro minutos e cinco apoios ocultos para as perguntas e o plano B. Roteiro: `presentations/roteiro-pitch-claro.md`; autoria: `presentations/build-pitch-claro.mjs`. As fontes usadas estão em `presentations/assets/fonts`; instale os arquivos TTF no computador da apresentação para preservar a tipografia ao editar no PowerPoint. As capturas continuam identificadas como dados fictícios e o fluxo da solução permanece copiar/colar texto, organizar, revisar e confirmar.

A apresentação em `output/presentations/Divas-Black-Pitch-Texto.pptx` segue a identidade clara. São cinco slides para quatro minutos e quatro slides ocultos de apoio (critérios e capturas reais da demo). O fluxo da solução usa entrada manual por copiar e colar texto, organização dos campos e revisão pela Carina. As notas do apresentador incluem tempos, responsáveis, fontes, limites das simulações e sequência da demonstração. O roteiro também está em `presentations/roteiro-pitch.md`. O link `localhost:3000` funciona apenas no computador com a demo ligada; as capturas ficam incorporadas ao arquivo para o plano B. As capturas atuais mostram um rascunho fictício já preenchido, não comprovam processamento de texto livre. O processo de autoria está em `presentations/build-pitch.mjs` e usa o runtime de apresentações do Codex.

- [Requisitos funcionais e regras de negócio](docs/requisitos.md)
- [Contrato para API, agente e persistência](docs/integracao.md)
- [Viabilidade e custos para uma usuária no celular](docs/plano-negocios.md)

Compras são pagas no momento do registro. Consumo de material é explícito; concluir atendimento não baixa estoque nem recebe pagamento automaticamente. A receber e caixa realizado ficam separados.

Sem autenticação, esta implantação é uma demonstração com dados fictícios. Antes de usar dados reais, implementar controle de acesso com a equipe responsável pela API.
