# Divas Black — viabilidade para uma usuária no celular

Consulta de preços: 7 de novembro de 2026. Este plano considera uma profissional, um salão e uso principal no celular, sem integração real de WhatsApp ou IA. É uma proposta de operação; não representa implantação já realizada.

## Proposta de uso

O produto reúne agenda, clientes, caixa e lista de compras para reduzir digitação, esquecimentos e consultas a anotações separadas. Não exige uma estrutura de empresa de software, vários servidores ou planos por funcionária. A profissional abre um link e pode colocar um ícone na tela inicial. Preparar uma PWA deixa essa experiência mais próxima de um aplicativo, sem publicação em loja. Esse recurso ainda precisa ser implementado e verificado no celular dela.

A arquitetura recomendada é: celular → aplicação web hospedada → servidor da aplicação → Supabase. O computador do desenvolvedor não participa do uso diário. Na primeira versão conectada, internet será necessária para consultar e salvar. Instalar um ícone não cria funcionamento offline automaticamente.

Mesmo com uma única usuária, publicar o sistema com dados reais exige login privado, recuperação de acesso e autorização nas rotas do servidor. Hoje a aplicação está sem autenticação, por escolha da fase de demonstração. Uma URL difícil de adivinhar não substitui proteção de acesso. As chaves secretas continuam somente no servidor.

## Orçamento de infraestrutura

| Alternativa | Base mensal em dólares | Simulação mensal em reais | Adequação |
|---|---:|---:|---|
| Netlify Free + Supabase Free | US$ 0 | R$ 0 | Piloto econômico, condicionado às cotas e à aceitação de possíveis pausas. |
| Vercel Pro + Supabase Free | US$ 20 | R$ 110 | Uso comercial mantendo a hospedagem Vercel prevista no projeto. |
| Vercel Pro + Supabase Pro | A partir de US$ 45 | A partir de R$ 247,50 | Mais recursos e backups gerenciados no banco. |
| Servidor no computador existente | Sem assinatura de hospedagem | R$ 0 de hospedagem | Somente enquanto o computador estiver ligado e acessível. |

Conversão ilustrativa para orçamento: **US$ 1 = R$ 5,50**. Não é cotação cambial do dia. Impostos, IOF, variação cambial, spread do cartão, excedentes, equipamentos, energia, internet, manutenção e integrações futuras não estão incluídos. Os cenários Vercel equivalem a R$ 1.320/ano e R$ 2.970/ano nessa hipótese, antes desses adicionais.

A Vercel cobra US$ 20/mês no Pro, incluindo um acesso de desenvolvedor para publicar. A usuária do aplicativo não precisa de um assento na plataforma. Excedentes e outros desenvolvedores com permissão de publicação podem elevar a conta. O Hobby gratuito se destina a uso pessoal não comercial; gerir o salão é uso comercial mesmo com uma única pessoa. [Pro](https://vercel.com/docs/plans/pro-plan), [Hobby](https://vercel.com/docs/plans/hobby).

A Netlify permite projetos comerciais no Free e suporta Next.js. É uma alternativa à Vercel para buscar mensalidade zero; o endereço final será da Netlify, salvo domínio próprio opcional. A publicação desse projeto ainda precisa de teste nessa plataforma. [Uso comercial](https://www.netlify.com/blog/introducing-netlify-free-plan/), [suporte ao Next.js](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/).

## Por quanto tempo pode ficar gratuito?

Não existe uma quantidade de meses garantida. Para uma usuária e registros principalmente de texto, considero plausível começar dentro das cotas gratuitas. Essa é uma estimativa técnica que precisa ser confirmada pelo consumo real, e não uma promessa de gratuidade por um ano.

O Supabase Free inclui 500 MB de banco e 5 GB de transferência de saída. Projetos com pouca atividade podem ser pausados após uma semana; abrir o aplicativo ocasionalmente não garante evitar isso. O Pro começa em US$ 25/mês, inclui uma instância Micro pelos créditos de computação e backups diários retidos por sete dias. [Preços](https://supabase.com/pricing), [pausas por atividade](https://supabase.com/docs/guides/platform/free-project-pausing).

A Netlify Free oferece 300 créditos por mês. Publicações, tráfego e processamento consomem a mesma franquia. Cada publicação em produção custa 15 créditos: quatro atualizações mensais já reservam 60, deixando 240 para o restante. Registrar um atendimento não é publicar uma nova versão. No Free há limite rígido; atingir a franquia pode interromper o acesso até renovação ou mudança de plano. [Franquias e consumo](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/).

A versão atual guarda um snapshot do salão e transfere o histórico completo nas leituras e gravações. Portanto, o tráfego pode crescer antes de acabar o espaço do banco. Convém medir o primeiro mês e depois separar os registros em tabelas e consultar somente o necessário. Não armazenar fotos grandes no snapshot. Monitorar consumo e revisar a solução ao alcançar 70% de uma franquia é uma regra de operação proposta para este projeto, não um limite adicional do provedor.

## Rodar localmente e usar no celular

Para demonstração, o computador executa `npm run dev:demo` na porta 3000. O celular, na mesma rede Wi-Fi, acessa `http://IP-DO-COMPUTADOR:3000`, conforme a configuração de rede. `localhost` no celular aponta para o próprio celular. Se o computador desligar, o link deixa de funcionar. O modo demo guarda os dados no navegador, sem cópia central, e limpar esse armazenamento pode apagá-los.

A prévia conectada usa `npm run build` e `npm run preview:supabase` na porta 3001. Ela mantém os dados na nuvem, mas ainda depende do computador para servir a aplicação e de internet para alcançar o Supabase. Essas duas portas são ambientes de desenvolvimento, não dois serviços pagos.

Como ela quer usar apenas o celular, não recomendo depender de um computador ligado. Uma alternativa totalmente local no telefone exigiria outra etapa: banco persistente no dispositivo, cópia de segurança exportável e restauração, além de funcionamento offline. IndexedDB ou um aplicativo com SQLite seriam opções de implementação. Isso ainda não existe no produto; a demonstração com localStorage não oferece a mesma proteção, e perder o celular sem backup pode significar perder os dados.

## Implantação e sustentação propostas

1. Concluir a conexão Supabase, implementar uma única conta privada e restringir acesso aos dados no servidor. Remover exemplos antes de iniciar o cadastro real.
2. Preparar ícone e instalação na tela inicial; validar agenda, formulários, PDF e planilha no aparelho da usuária.
3. Testar publicação na Netlify Free com Supabase Free se a prioridade for custo zero. Se o endereço Vercel for requisito, reservar o Pro desde o início da operação comercial.
4. Acompanhar um piloto de 30 dias, medindo consumo e verificando se há indisponibilidade por pausas. A usuária deve conhecer essa limitação dos planos gratuitos.
5. Definir backup completo fora do banco e testar restauração. PDF e planilha financeira ajudam na consulta, mas não substituem uma cópia restaurável de todo o sistema. O procedimento, sua frequência e o responsável ainda precisam ser implementados/definidos.
6. Manter uma pessoa responsável por atualizações, falhas e recuperação. Trabalho de desenvolvimento e suporte deve ser orçado separadamente, sem inventar valor antes de definir escopo e disponibilidade.

Minha recomendação para este caso é validar a operação com mensalidade de infraestrutura zero, usando hospedagem que permita uso comercial gratuito, sem comprar Supabase Pro antecipadamente apenas pelo número de usuárias. Se pausas e rotinas manuais de backup forem incompatíveis com o dia a dia, o banco pago pode fazer sentido mesmo com pouco volume. Permanecer na Vercel implica reservar ao menos US$ 20/mês; combinar os dois planos Pro começa em US$ 45/mês. WhatsApp e IA reais ficam em orçamento separado quando houver fornecedor e volume definidos.
