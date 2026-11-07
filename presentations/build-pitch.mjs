import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Build with the Codex bundled presentation runtime. App dependencies stay unchanged.
const root=process.cwd();
const runtime=path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies');
const modules=process.env.ARTIFACT_NODE_MODULES||path.join(runtime,'node/node_modules');
process.env.RUNTIME_NODE_MODULES=modules;
const skill=path.join(process.env.USERPROFILE,'.codex/plugins/cache/openai-primary-runtime/presentations/26.1026.10807/skills/presentations');
const {Presentation,PresentationFile}=await import(pathToFileURL(path.join(modules,'@oai/artifact-tool/dist/artifact_tool.mjs')));
const {finalizePresentation}=await import(pathToFileURL(path.join(skill,'container_tools/artifact_tool_utils.mjs')));
const staging=path.join(root,'.cache/pitch-build');
const finalPath=path.join(root,'output/presentations/Divas-Black-Pitch-Texto.pptx');
await fs.mkdir(staging,{recursive:true});await fs.mkdir(path.dirname(finalPath),{recursive:true});
const presentation=Presentation.create({slideSize:{width:1280,height:720}});
const ink='#111111',pink='#FF1493',muted='#565056';
const sources='Fontes: pitch.md; Contexto_Projeto_Diva_Hackathon.md (07/11/2026); 04_caderno_do_grupo_A4_27pag.pdf, páginas 4 e 17. A frase de abertura foi confirmada como literal pela equipe nesta conversa. A orientação mais recente da equipe define entrada manual por copiar e colar texto. Capturas da aplicação local em modo demo, com dados fictícios, 07/11/2026.';
function txt(slide,text,x,y,w,h,size=28,color=ink,bold=false){
 const shape=slide.shapes.add({geometry:'textbox',name:text.replace(/\n/g,' ').slice(0,75),position:{left:x,top:y,width:w,height:h},fill:'none',line:{fill:'none',width:0}});
 shape.text=text;shape.text.style={fontSize:size,typeface:'Arial',color,bold,insets:0,verticalAlignment:'top',wrap:'square',autoFit:'none'};return shape;
}
function slide(notes,hidden=false){const s=presentation.slides.add();s.background.fill='#FFFFFF';s.hidden=hidden;s.speakerNotes.text=notes+'\n\n'+sources;return s;}
async function photo(s,name,x,y,w,h,alt){const b=await fs.readFile(path.join(root,'presentations/assets',name));s.images.add({blob:b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),contentType:'image/png',alt,fit:'contain',position:{left:x,top:y,width:w,height:h}});}

let s=slide(`0:00–0:45. Responsáveis: Carina na abertura e equipe na conexão com o desafio.
Carina: “Dificuldade de acompanhar quanto entra e quanto sai.” Continue com suas próprias palavras, contando brevemente como os atendimentos e o dinheiro fazem parte do seu dia.
Equipe: Carina é a Diva, empreendedora de tranças e cuidados capilares com cerca de sete anos de trajetória. A prioridade que trouxemos para o protótipo é enxergar o dinheiro junto com os atendimentos e os materiais. Não atribuir a ela nenhuma outra frase ensaiada como se fosse depoimento real.`);
txt(s,'Divas Black',64,66,1148,128,104,ink,true);
txt(s,'Gestão do salão no celular',68,214,1120,70,47);
txt(s,'“Dificuldade de acompanhar\nquanto entra e quanto sai.”',68,354,1110,148,48,pink,true);
txt(s,'Carina, a Diva\nTranças e cuidados capilares há cerca de 7 anos',70,590,1100,76,25,muted);

s=slide(`0:45–1:30. Responsável: equipe.
O relato e os materiais do Canvas e da Árvore do Desafio apontam concentração de tarefas em Carina, dificuldade de acompanhar o dinheiro e efeitos como sobrecarga e expansão limitada. Nosso recorte conecta o que foi combinado com o que foi recebido e o que precisa ser comprado. Esse é o desafio de gestão, não apenas a falta de uma agenda digital.
Desafio em uma frase: como organizar a gestão sem aumentar o trabalho da Carina?
Evidência de construção conjunta a apresentar: a frase dela e a participação de Carina na revisão do atendimento. Só relatar resultados de teste ou feedback adicional se realmente ocorreram. Não afirmar economia de tempo, aumento de receita ou validação final sem observação.`);
txt(s,'A rotina inteira passa pela Carina',64,60,1152,130,54,ink,true);
txt(s,'O que ouvimos',66,228,515,38,25,pink,true);
txt(s,'Atender e cuidar das clientes\nDiscutir horários e responder mensagens\nComprar materiais e acompanhar o dinheiro',66,292,515,185,29);
txt(s,'O desafio priorizado',677,228,535,38,25,pink,true);
txt(s,'Dinheiro e materiais ficam\nsem conexão com os\natendimentos',677,292,535,185,39,ink,true);
txt(s,'Conversa, Canvas do Negócio e Árvore do Desafio',66,500,1130,40,24,muted);
txt(s,'Como organizar a gestão sem aumentar o trabalho dela?',66,567,1130,90,35,pink,true);

s=slide(`1:30–2:30. Responsável: equipe.
Apresentamos a Divas Black, uma aplicação para uso individual no celular. A agenda usa post-its por serviço. Caixa separa valores recebidos, despesas e pendências. Estoque combina a demanda dos atendimentos, os extras informados e a reserva mínima, com preços editáveis.
O fluxo da solução começa com uma ação da Carina: ela copia o texto recebido da cliente e cola na aplicação. O sistema organiza cliente, serviço, data e valor em campos revisáveis. Ela corrige o que precisar e confirma o atendimento. A entrada é manual por copiar e colar texto, sem integração automática com canais de mensagem.
As capturas usam um rascunho fictício já preenchido e demonstram revisão, confirmação e regras de gestão. Não apresentar essas capturas como prova de processamento real de qualquer texto livre. Na demonstração ao vivo, mostrar a entrada por texto na versão que tenha esse campo disponível.
Agendar gera previsão. Só confirmar recebimento gera entrada no caixa. Comprar e pagar material gera saída e atualiza estoque. PDF e Excel permitem levar os registros para fora da aplicação.
A captura usa valores fictícios, não resultados financeiros reais do salão.`);
txt(s,'Agenda, caixa e estoque conectados',64,55,1152,110,50,ink,true);
txt(s,'Texto vira agendamento',64,215,355,42,28,ink,true);
txt(s,'Ela cola o texto, revisa\nos dados e confirma',64,265,344,78,25,muted);
txt(s,'Caixa com valores reais',64,360,350,42,29,ink,true);
txt(s,'Recebimentos e despesas\nseparados da previsão',64,410,345,76,25,muted);
txt(s,'Compras planejadas',64,504,350,42,29,ink,true);
txt(s,'Demanda, estoque e preços\nna mesma lista',64,553,345,76,25,muted);
await photo(s,'inicio-claro.png',435,150,790,503,'Tela real do início na versão clara, com dados fictícios de demonstração');
txt(s,'Copiar o texto. Colar. Revisar. Confirmar.',64,658,1152,38,27,pink,true);

s=slide(`2:30–3:30. Responsáveis: equipe e Carina.
ANTES DA APRESENTAÇÃO: abrir a versão com entrada por texto e testar o campo de colar mensagem. Preparar um texto fictício e escolher um horário livre. A demo local está em http://localhost:3000. Não usar dados pessoais reais.
AO VIVO: 1) Carina copia e cola o texto de um atendimento de exemplo. O sistema organiza os campos. 2) Ela revisa e confirma data, horário livre e valor de R$ 300. 3) Mostrar que o atendimento entra na agenda, sem registrar entrada financeira. 4) Registrar um sinal de R$ 50 e mostrar R$ 250 pendentes. 5) Abrir Estoque e mostrar uma necessidade de reposição, com Pomada e Mousse fixos na lista.
LIMITE DAS CAPTURAS: a demo capturada tem um rascunho fictício predefinido, não um campo de texto livre. Se essa for a versão disponível na hora, mostrar a revisão a partir desse exemplo e explicar que a entrada por copiar e colar é o fluxo definido para a solução. Não fingir que um texto colado foi processado nessa versão.
Se a demonstração falhar, usar a captura deste slide e os slides ocultos 7, 8 e 9 como plano B. Não apresentar a captura como demonstração ao vivo. Os valores são um exemplo fictício.
Pergunta curta para Carina durante a prova: “Esse jeito de separar o que recebeu do que falta receber te ajuda a acompanhar o salão?” Deixar que ela responda com suas próprias palavras.`);
txt(s,'Um atendimento na prática',64,55,1152,80,54,ink,true);
txt(s,'R$ 300 combinados',66,186,660,63,46,ink,true);
txt(s,'R$ 50 recebidos',66,268,660,63,46,pink,true);
txt(s,'R$ 250 a receber',66,350,660,63,46,ink,true);
txt(s,'Texto colado e organizado\nRevisão e confirmação pela Carina\nSinal registrado no caixa',68,466,630,120,28,muted);
await photo(s,'pagamento-parcial.png',757,158,450,510,'Atendimento fictício com R$ 300 combinados, R$ 50 recebidos e R$ 250 a receber');
const link=txt(s,'Demonstração local: localhost:3000',68,640,650,38,23,pink,true);link.text.get('localhost:3000').link={uri:'http://localhost:3000',isExternal:true};
txt(s,'Exemplo fictício',934,680,275,25,18,muted);

s=slide(`3:30–4:00. Responsáveis: equipe e Carina no encerramento.
Equipe: os benefícios esperados são mais clareza sobre o dinheiro e compras mais planejadas, com consulta no próprio celular. Não apresentar esses benefícios como impacto já medido. No futuro, essa organização pode apoiar o desejo da Carina de delegar responsabilidades e formar outras pessoas.
Caminho até o uso: uma única conta privada, backup com restauração testada e piloto com Carina no aparelho dela. O protótipo atual não tem autenticação e deve usar só dados fictícios. A hospedagem em nuvem evita depender do computador do desenvolvedor. Na primeira versão conectada, é necessária internet. Não prometer funcionamento offline nem mensalidade zero garantida.
Carina encerra com suas palavras: qual parte seria mais útil para seu salão e o que ela precisa para começar a usar. Reservar aproximadamente 15 segundos para ela. Nenhum depoimento de impacto foi inventado.
Depois: dois minutos de perguntas. Critérios e plano B estão nos slides ocultos.`);
txt(s,'Uso individual, direto no celular',64,57,815,128,51,ink,true);
txt(s,'Mais clareza sobre o dinheiro\ne as próximas compras',66,241,790,115,38,ink,true);
txt(s,'Uma rotina organizada para\ndepender menos da memória',66,384,790,104,33);
txt(s,'Próximo passo',67,525,780,36,25,pink,true);
txt(s,'Login privado, backup e piloto com Carina',67,573,780,78,29,muted);
txt(s,'No futuro: apoio para delegar e formar outras pessoas',67,664,810,37,23,pink);
await photo(s,'celular-claro.png',946,142,244,528,'Interface real da demo clara no tamanho de um celular');

s=slide(`APOIO, fora dos 4 minutos. Critérios da apresentação final, caderno página 4. Cada critério recebe nota de 1 a 5 e os pesos somam 100%. Estes não são os pesos das rodadas 1 e 2.
Diagnóstico: usar a frase confirmada e explicar a causa priorizada. Funcionalidade: mostrar o fluxo real do protótipo. Co-criação: Carina participa de pelo menos dois momentos e revisa dados. Adoção: explicar login privado, backup e piloto, sem esconder o trabalho ainda necessário. Clareza: manter os cinco passos e ensaiar com cronômetro.
Ainda é necessário registrar os resultados do teste de uso com Carina. O roteiro não substitui evidência de validação. Não dizer que o sistema aumentou receita, economizou minutos ou recebeu aprovação final sem fatos.`,true);
txt(s,'Critérios da banca',64,58,1152,85,54,ink,true);
const values=[['Critério','Peso','Evidência no pitch'],['Profundidade do diagnóstico','25%','Relato, Canvas, Árvore e desafio'],['Funcionalidade real','25%','Agenda e pagamento parcial ao vivo'],['Qualidade da co-criação','20%','Carina abre, revisa e encerra'],['Potencial de adoção','20%','Celular, acesso privado, backup e piloto'],['Clareza da apresentação','10%','Cinco passos em quatro minutos']];
const table=s.tables.add({rows:6,columns:3,left:64,top:183,width:1152,height:390,columnWidths:[389,115,648],values});
table.borders.assign({fill:'#E7E6E0',width:1,style:'solid'});
for(let r=0;r<6;r++)for(let c=0;c<3;c++){const cell=table.getCell(r,c);cell.fill=r===0?pink:'#FFFFFF';cell.text.style={typeface:'Arial',fontSize:24,bold:r===0,color:ink,insets:14,verticalAlignment:'middle'};}
txt(s,'Pesos da apresentação final: caderno, p. 4. Roteiro: p. 17.',66,622,1148,40,22,muted);

const support=[
 ['Texto colado, atendimento organizado','assistente-simulada.png','Entrada manual por texto. A Carina revisa cliente, serviço, data e valor antes de confirmar.'],
 ['Atendimentos visíveis na agenda','agenda-clara.png','Cada post-it mostra horário, cliente, serviço e situação do pagamento.'],
 ['O que falta comprar para atender','estoque-claro.png','Demanda e estoque formam a lista. Pomada e Mousse são fixos, com preço editável.'],
];
for(const [title,file,caption] of support){
 s=slide(`PLANO B. Slide oculto, fora dos quatro minutos. Usar somente se não for possível mostrar a aplicação ao vivo. Dizer claramente: “Esta é uma captura real do nosso protótipo, com dados fictícios.”\n${caption}\nA captura não comprova teste de adoção nem impacto real no salão.`,true);
 txt(s,title,64,45,1152,104,48,ink,true);
 if(file==='assistente-simulada.png'){
  txt(s,'Copiar e colar',66,230,510,40,29,pink,true);txt(s,'A Carina cola o texto\nque recebeu da cliente',66,285,510,110,34);
  txt(s,'Conferir e confirmar',66,432,510,40,29,pink,true);txt(s,'O sistema organiza os campos.\nEla revisa antes de salvar',66,485,510,100,32);
  await photo(s,file,656,157,558,476,title+' na aplicação real, em modo demonstração');
 }else await photo(s,file,64,163,1152,460,title+' na aplicação real, em modo demonstração');
 txt(s,caption,66,649,1148,58,23,muted);
}

const candidate=path.join(staging,'candidate.pptx');
await (await PresentationFile.exportPptx(presentation)).save(candidate);
for(const [i,s] of presentation.slides.items.entries()){
 const png=await presentation.export({slide:s,format:'png',scale:1});
 await fs.writeFile(path.join(staging,`slide-${String(i+1).padStart(2,'0')}.png`),new Uint8Array(await png.arrayBuffer()));
}
await fs.writeFile(path.join(staging,'notes.md'),presentation.slides.items.map((s,i)=>`# Slide ${i+1}\n\n${s.speakerNotes.text}`).join('\n\n'));
const result=await finalizePresentation({workspaceDir:root,candidatePath:candidate,finalPath,pythonExecutable:path.join(runtime,'python/python.exe'),integrityValidatorPath:path.join(skill,'container_tools/inspect_presentation_package_integrity.py'),layoutValidatorPath:path.join(skill,'container_tools/inspect_presentation_layout_geometry.py'),layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-bullet-geometry','--validate-heading-fit','--require-native-table-slide','6'],explicitTotalSlideCount:9,requiredNativeTableOwnerSlides:[6],requiredNativeChartOwnerSlides:[],fontPolicy:{basis:'design',families:['Arial']},verifyArtifactToolImport:true,receiptPath:path.join(staging,'texto-validation.json')});
console.log(JSON.stringify({finalPath,slides:presentation.slides.items.length,validation:result.status||'completed'}));
