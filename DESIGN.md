---
name: Divas Black
description: Agenda visual e gestão rápida do salão, com preto, rosa forte e post-its por serviço.
colors:
  pink: "#ff1493"
  ink: "#111111"
  canvas: "#f6f5f1"
  surface: "#ffffff"
  muted: "#74746f"
  line: "#e7e6e0"
  focus: "#c90072"
  pink-hover: "#f00083"
  note-pink: "#F4B6DA"
  note-lavender: "#E4D5F9"
  note-yellow: "#F4DE9C"
  note-green: "#C4E3D5"
  note-blue: "#C6DCF7"
  metric-pink: "#ffd4eb"
  metric-yellow: "#ecefc7"
  error-background: "#fff0f1"
  error-text: "#9c2034"
typography:
  display:
    fontFamily: "Space Grotesk, sans-serif"
    fontSize: "clamp(30px, 2.8vw, 43px)"
    fontWeight: 600
    lineHeight: 1.12
    letterSpacing: "-0.04em"
  title:
    fontFamily: "Space Grotesk, sans-serif"
    fontSize: "21px"
    fontWeight: 600
    letterSpacing: "-0.035em"
  metric:
    fontFamily: "Space Grotesk, sans-serif"
    fontSize: "clamp(29px, 2.6vw, 41px)"
    fontWeight: 500
    letterSpacing: "-0.05em"
  body:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "18px"
    fontWeight: 400
  button:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "16px"
    fontWeight: 600
  field:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.4
rounded:
  button: "9px"
  form: "12px"
  panel: "15px"
  note: "3px 3px 16px 3px"
  pill: "30px"
spacing:
  field-gap: "8px"
  grid-gap: "14px"
  columns-gap: "16px"
  form-gap: "22px"
  panel-padding: "25px"
  drawer-padding: "28px"
components:
  button-primary:
    backgroundColor: "{colors.pink}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.button}"
    padding: "12px 18px"
  button-dark:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.button}"
    padding: "12px 18px"
  button-form-primary:
    backgroundColor: "{colors.pink}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.form}"
    padding: "12px 18px"
  button-form-primary-hover:
    backgroundColor: "{colors.pink-hover}"
  panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.panel}"
    padding: "{spacing.panel-padding}"
  input-form:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.field}"
    rounded: "{rounded.form}"
    padding: "12px 14px"
  postit:
    backgroundColor: "{colors.note-pink}"
    textColor: "{colors.ink}"
    rounded: "{rounded.note}"
    padding: "15px 13px"
---

# Design System: Divas Black

## Overview

**Creative North Star: "O salão em post-its"**

Interface de operação para consultar e registrar informações entre atendimentos. A marca aparece no menu preto e nas ações em rosa forte; superfícies claras organizam números, formulários e listas. O elemento distintivo é o atendimento em post-it quase quadrado, colorido conforme o serviço e acompanhado de texto.

Esta documentação atualiza a direção inicial com os estilos implementados em `app/globals.css`, `components/screens.css` e `components/operation-panel.css`. Fontes e proporções foram extraídas do código. Testes de DOM e HTTP não constituem validação visual por screenshots do estado final.

**Key Characteristics:**

- Ações curtas, números em destaque e linguagem familiar.
- Preto e rosa forte como identidade permanente.
- Cor por serviço, com nome e estado sempre legíveis.
- Desktop com menu lateral; celular com navegação inferior e opções adicionais.

## Colors

### Primary

O rosa forte (`pink`) identifica ação principal, item ativo no menu, detalhes da marca e foco global. O preto (`ink`) sustenta navegação e valores de maior destaque. Botões rosa usam texto escuro.

### Secondary

Os cinco tons `note-*` distinguem serviços na agenda. O cadastro permite outras cores; a interface calcula texto claro ou escuro para o fundo escolhido. Os tons de métricas são superfícies auxiliares e não substituem a identidade principal.

### Neutral

O fundo `canvas` separa os painéis brancos `surface`. `muted` serve a informação secundária; `line` mantém divisórias discretas. Campos e cabeçalhos do painel lateral usam branco. Erros têm superfície rosada e texto escuro próprios.

**The Color-and-Text Rule.** Nome do serviço, estado e pagamento precisam continuar compreensíveis sem depender da cor.

## Typography

**Display Font:** Space Grotesk, com fallback sans-serif; pesos locais 500, 600 e 700.

**Body Font:** DM Sans, com fallback sans-serif; pesos locais 400, 500, 600 e 700.

As fontes são servidas pelo próprio aplicativo via `@fontsource`, sem requisição de fonte ao Google. A combinação usa títulos compactos e corpo amplo para consulta rápida.

### Hierarchy

- **Display:** títulos de página com escala fluida do frontmatter; no celular, título principal em 35px.
- **Title:** títulos de seção em torno de 20–26px, com ajustes por componente; cabeçalho do painel em 26px, reduzido a 23px no celular.
- **Metric:** números principais com Space Grotesk, espaçamento fechado e algarismos tabulares; tamanhos responsivos entre 27 e 41px nos cartões.
- **Body:** base em 18px; campos do painel usam 18px no desktop e 16px em telas estreitas.
- **Label:** informações de apoio normalmente entre 12 e 16px; horário e serviço nos post-its em 13 e 14px, respectivamente. Nomes das clientes nos post-its em 18px.

**The Numbers Rule.** Valores monetários em destaque usam algarismos tabulares e permanecem separados de seus rótulos e períodos.

## Layout

O menu lateral fixo ocupa 222px no desktop, 195px até 1250px e 174px até 1000px. O conteúdo principal acompanha essas larguras, com margem interna de 34px no desktop e limite de 1900px. Telas largas a partir de 1550px usam margem interna de 48px.

Até 700px, o menu lateral desaparece; o conteúdo ocupa toda a largura com margem de 17px e espaço inferior reservado. A navegação inferior fixa tem pelo menos 78px e respeita a área segura do dispositivo. As opções adicionais aparecem acima dela. Métricas passam a duas colunas; listas e grades de serviços se reorganizam para leitura no celular.

A semana usa sete colunas com largura mínima de 190px; o mês usa sete colunas de pelo menos 150px. Essas visualizações têm rolagem horizontal própria. O dia usa até três post-its por linha no desktop, dois até 1000px e uma coluna abaixo de 370px.

O painel de operação mede no máximo 560px de largura e ocupa 100dvh; tem cabeçalho fixo durante sua rolagem interna. Até 560px, margens internas e fontes dos campos ficam mais compactas.

## Elevation & Depth

Painéis e métricas se separam principalmente por fundo e borda, com pouca elevação. Post-its têm sombra curta e dobra no canto; hover sobe 3px e reforça a sombra. O painel lateral usa sombra mais ampla sobre fundo escurecido com desfoque.

Sombras e movimento exatos estão em `.impeccable/design.json`. Transições de controles ficam em torno de 150–200ms. A preferência de movimento reduzido remove animações e transições.

## Shapes

Botões principais de página usam cantos de 9px; campos e botões do painel usam 12px; painéis usam aproximadamente 15px. Indicadores pequenos alternam círculos e pílulas. Post-its têm três cantos discretos e canto inferior direito dobrado, mantendo a aparência de papel.

O post-it padrão tem proporção preferida de 1:1,05; o dia no desktop aproxima-se de 1:1,02. No celular, o padrão é 1:1,11 e a visualização diária usa 1:1,13. O resumo usa 1:1,06 no desktop e 1:1,09 no celular. Abaixo de 370px, o cartão fica em uma coluna com proporção 1,25:1. A altura pode crescer para acomodar conteúdo; o mês mantém cartões mais compactos, sem proporção fixa.

## Components

### Buttons

Página: botões rosa com texto preto, preenchimento do frontmatter e altura mínima de 48px; alternativa preta com texto branco. Painel: botões primários e secundários com altura mínima de 52px. Controles compactos variam entre 43 e 46px em algumas telas; não assumir que todo rótulo clicável seja uma ação principal.

Hover mantém mudança discreta de fundo ou brilho. Foco global usa contorno rosa de 3px; o painel usa o tom `focus`. Estado ocupado desabilita ações de gravação e mostra “Salvando…”.

### Cards / Containers

Painéis brancos usam borda clara e preenchimento de 25px, com ajuste no celular. Métricas combinam preto, branco, rosa claro e amarelo claro. Cartões de serviço exibem cor, nome, preço e duração; a lista de compra realça a quantidade faltante.

### Inputs / Fields

Campos do painel têm borda neutra, altura mínima de 52px e preenchimento do frontmatter. Rótulos ficam acima do controle. Foco combina contorno rosado e borda mais escura; erros aparecem em bloco com anúncio de alerta. Campos desativados usam fundo neutro e texto atenuado. Busca destaca seu contêiner com `focus-within`.

### Navigation

Menu lateral preto com ícone e nome; item ativo rosa e texto preto. No celular, a navegação inferior branca usa texto e ícone ativos em rosa escuro, com alvos de pelo menos 50px de altura. O menu adicional é preto, acima da barra inferior.

### Post-its

Cada atendimento mostra horário, cliente, serviço, estado e informação de pagamento. Cor e nome do serviço vêm do snapshot do atendimento. A dobra é feita em CSS. Preserve as proporções quase quadradas documentadas em Shapes; não retornar aos cartões longos da primeira versão. O mês reduz detalhes para manter a consulta de datas.

### Operation Panel

Painel lateral com título visível, fechar por botão/Escape, foco levado ao diálogo e retorno ao gatilho ao fechar. Formulários apresentam poucos campos principais e revelam materiais do serviço em seção expansível. Cancelamento e ausência pedem confirmação dentro do painel.

## Do's and Don'ts

### Do:

- **Do** preservar a identidade preta e rosa forte e os fundos claros de operação.
- **Do** usar nomes, valores e estados junto com cor; respeitar o contraste calculado de cores personalizadas.
- **Do** manter ações principais amplas, foco visível e espaço para navegação móvel.
- **Do** preservar os post-its quase quadrados e seu conteúdo curto.
- **Do** separar visualmente recebido, gasto, saldo do período e previsão a receber.

### Don't:

- **Don't** substituir a tipografia escolhida por fonte de rede ou reduzir os campos para caber mais conteúdo.
- **Don't** transformar a agenda em notas estreitas e muito altas.
- **Don't** depender de hover ou apenas da cor para explicar ação, serviço ou estado.
- **Don't** declarar a interface final validada visualmente com screenshots quando houve somente inspeção de código, DOM e HTTP.
