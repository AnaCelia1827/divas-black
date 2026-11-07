import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';

// Pitch.pdf supplies the visual reference, not the claims of its other project.
const root=process.cwd();
const runtime=path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies');
const modules=process.env.ARTIFACT_NODE_MODULES||path.join(runtime,'node/node_modules');
process.env.RUNTIME_NODE_MODULES=modules;
const artifactPath=path.join(modules,'@oai/artifact-tool/dist/artifact_tool.mjs');
const require=createRequire(pathToFileURL(artifactPath));
const {FontLibrary}=require('skia-canvas');
FontLibrary.use('Inter18pt',['Inter18pt-Regular.ttf','Inter18pt-Bold.ttf'].map(n=>path.join(root,'presentations/assets/fonts',n)));
const {Presentation,PresentationFile}=await import(pathToFileURL(artifactPath));
const skill=path.join(process.env.USERPROFILE,'.codex/plugins/cache/openai-primary-runtime/presentations/26.1026.10807/skills/presentations');
const {finalizePresentation}=await import(pathToFileURL(path.join(skill,'container_tools/artifact_tool_utils.mjs')));
const staging=path.join(root,'.cache/pitch-estilo-claro');
const finalPath=path.join(root,'output/presentations/Divas-Black-Pitch-Claro.pptx');
const referencePath=path.join(process.env.USERPROFILE,'Downloads/Pitch.pdf');
const referenceSha256=createHash('sha256').update(await fs.readFile(referencePath)).digest('hex');
await fs.mkdir(staging,{recursive:true});await fs.mkdir(path.dirname(finalPath),{recursive:true});
const presentation=Presentation.create({slideSize:{width:1440,height:810}});
const ink='#111111',pink='#FF007F',muted='#535057',label='#A00055';
const oldNotes=(await fs.readFile(path.join(root,'presentations/roteiro-pitch.md'),'utf8')).split(/^# Slide \d+\s*$/m).slice(1).map(s=>s.split(/\nFontes:/)[0].trim());
const sources='Fontes de conteúdo: pitch.md; Contexto_Projeto_Diva_Hackathon.md; caderno do grupo, p. 4 e 17; foto dos critérios enviada pela equipe em 07/11/2026. Referência visual: Pitch.pdf, 27 páginas, 1440 × 810; seu conteúdo de outro projeto não integra este pitch. Frase de abertura literal confirmada pela equipe. Fluxo definido pela equipe: copiar e colar texto, organizar campos, revisar e confirmar. Capturas reais do protótipo com dados fictícios.';
function text(s,value,x,y,w,h,size=30,{color=ink,bold=false,center=false,fill='none'}={}){
 const q=s.shapes.add({geometry:'textbox',name:value.replace(/\n/g,' ').slice(0,85),position:{left:x,top:y,width:w,height:h},fill,line:{fill:'none',width:0}});
 q.text=value;q.text.style={fontSize:size,typeface:'Inter18pt',color,bold,insets:fill==='none'?0:8,alignment:center?'center':'left',verticalAlignment:fill==='none'?'top':'middle',wrap:'square',autoFit:'none'};return q;
}
async function image(s,file,x,y,w,h,alt){const b=await fs.readFile(path.join(root,'presentations/assets',file));return s.images.add({blob:b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),contentType:'image/png',alt,fit:'contain',position:{left:x,top:y,width:w,height:h}});}
async function slide(note,{hidden=false,cover=false}={}){
 const s=presentation.slides.add();s.background.fill='#FFFFFF';s.hidden=hidden;s.speakerNotes.text=note+'\n\n'+sources;
 text(s,'ELAS CONECTAM',520,35,400,28,18,{color:label,bold:true,center:true});
 if(!cover){const b=text(s,'divas black.',1150,728,232,49,31,{bold:true,center:true});b.text.get('.').fill=pink;}
 await image(s,'faixa-referencia.png',0,796,1440,14,'Faixa de cores extraída do rodapé da referência visual');return s;
}
function title(s,value){text(s,value,80,96,1280,100,60,{bold:true,center:true});}
function banner(s,value,x,y,w=350){text(s,value,x,y,w,57,29,{bold:true,center:true,fill:pink});}

let s=await slide(oldNotes[0],{cover:true});
const brand=text(s,'divas black.',120,195,1200,150,130,{bold:true,center:true});brand.text.get('.').fill=pink;
text(s,'“Dificuldade de acompanhar\nquanto entra e quanto sai.”',140,383,1160,158,57,{bold:true,center:true,color:pink});
text(s,'Carina, a Diva',170,588,1100,48,32,{center:true,bold:true});
text(s,'Tranças e cuidados capilares há cerca de 7 anos',170,643,1100,40,26,{center:true,color:muted});

s=await slide(oldNotes[1]);title(s,'Da escuta à causa raiz');
const dx=[90,545,1000];
for(const [i,t] of ['RELATO','CAUSA PRIORIZADA','EFEITO'].entries())banner(s,t,dx[i],233,350);
text(s,'Entradas e saídas\ndifíceis de acompanhar',90,334,350,190,32,{center:true});
text(s,'Atendimento, caixa e\nmateriais sem uma\nvisão única',545,334,350,190,32,{center:true,bold:true});
text(s,'Sobrecarga para\nplanejar compras\ne próximos atendimentos',1000,334,350,190,32,{center:true});
text(s,'Como organizar a gestão\nsem aumentar o trabalho da Carina?',120,568,1200,104,39,{center:true,bold:true,color:pink});
text(s,'Relato, Canvas do Negócio e Árvore do Desafio',90,707,920,38,23,{color:muted});

s=await slide(oldNotes[2]);title(s,'Texto, agenda e gestão do salão');
text(s,'Um texto colado vira',100,254,825,65,47,{center:true,bold:true});
text(s,'atendimento revisável',100,324,825,65,47,{center:true,bold:true,color:pink});
text(s,'Agenda, caixa e estoque acompanham\no que a Carina confirma',110,440,805,107,33,{center:true});
text(s,'Copiar. Colar. Revisar. Confirmar.',110,590,805,44,30,{center:true,bold:true,color:label});
const phone=await image(s,'celular-claro.png',1030,182,260,536,'Aplicação no celular, versão clara, com dados fictícios');phone.rotation=7;

s=await slide(oldNotes[3]+'\nA parte crítica a mostrar ao vivo é confirmar um atendimento e registrar um sinal. A captura do pagamento está no slide oculto 10. Perguntas da banca: reservar dois minutos e direcionar pelo menos uma à empreendedora.');title(s,'Um atendimento, valores separados');
const moneyX=[100,565,1030];
for(const [i,h] of ['COMBINADO','RECEBIDO','A RECEBER'].entries())banner(s,h,moneyX[i],247,310);
for(const [i,v] of ['R$ 300','R$ 50','R$ 250'].entries())text(s,v,moneyX[i]-10,359,330,110,69,{center:true,bold:true,color:i===1?pink:ink});
text(s,'−',438,369,80,100,70,{center:true,bold:true,color:label});text(s,'=',903,369,80,100,70,{center:true,bold:true,color:label});
for(const [i,d] of ['Valor do atendimento','Sinal confirmado','Saldo pendente'].entries())text(s,d,moneyX[i]-25,491,360,70,28,{center:true,color:muted});
text(s,'Agora, a Carina registra um sinal ao vivo',140,614,1160,60,36,{center:true,bold:true});
const live=text(s,'Exemplo fictício. Demonstração local: localhost:3000',90,721,1000,40,22,{color:muted});live.text.get('localhost:3000').link={uri:'http://localhost:3000',isExternal:true};

s=await slide(oldNotes[4]+'\nCritério da foto: potencial de adoção significa que ela usa e mantém sozinha. Evidenciar autonomia nos cadastros, preços e demandas, sem prometer que manutenção técnica ou infraestrutura já estão resolvidas. Separar as ações operacionais que ela consegue executar dos próximos passos de implantação.');title(s,'Feita para a rotina da Carina');
banner(s,'USO NO DIA A DIA',130,237,500);banner(s,'CAMINHO ATÉ O USO',810,237,500);
text(s,'Um link no próprio celular\nClientes, serviços e preços editáveis\nCompras e registros para baixar',130,345,500,210,31,{center:true});
text(s,'Próximo passo:\nconta privada, backup e piloto\ncom a própria Carina',810,345,500,210,31,{center:true});
text(s,'Qual parte ajuda mais no seu salão?',140,611,1160,64,43,{center:true,bold:true,color:pink});

s=await slide('APOIO PARA OS DOIS MINUTOS DE PERGUNTAS. Critérios da foto enviada pela equipe: diagnóstico 25 pontos; funcionalidade real 25; co-criação 20; potencial de adoção 20; clareza 10. Cada critério deve ser sustentado por evidência, não apenas pelo roteiro. A banca espera a jornada em quatro minutos com todas. Reservar uma pergunta para a Carina. Não inventar dados de impacto ou resultados de teste.',{hidden:true});title(s,'Critérios da banca');
const values=[['Critério','Pontos','O que a banca pede','Onde mostramos'],['Diagnóstico','25','Evidência real até a causa raiz','Relato e causa priorizada'],['Funcionalidade real','25','A parte crítica funciona ao vivo','Atendimento e sinal no caixa'],['Co-criação','20','Ela reconhece a solução como dela','Carina abre, revisa e encerra'],['Potencial de adoção','20','Ela usa e mantém sozinha','Celular e cadastros editáveis'],['Clareza','10','A jornada em 4 min, com todas','Falas e demonstração ensaiadas']];
const table=s.tables.add({rows:6,columns:4,left:70,top:214,width:1300,height:400,columnWidths:[270,115,495,420],values});
table.borders.assign({fill:'#E4E0E3',width:1,style:'solid'});
for(let r=0;r<6;r++)for(let c=0;c<4;c++){const cell=table.getCell(r,c);cell.fill=r===0?pink:'#FFFFFF';cell.text.style={fontSize:24,typeface:'Inter18pt',color:ink,bold:r===0,insets:10,verticalAlignment:'middle'};}
text(s,'4 minutos de apresentação + 2 minutos de perguntas',90,654,1200,43,30,{center:true,bold:true});

s=await slide(oldNotes[6],{hidden:true});title(s,'Texto colado, atendimento organizado');
text(s,'A Carina copia e cola o texto',100,282,710,112,40,{center:true,bold:true,color:pink});
text(s,'O sistema organiza os campos.\nEla revisa antes de confirmar.',100,410,710,128,36,{center:true});
text(s,'Exemplo fictício de rascunho preenchido',100,600,710,68,25,{center:true,color:muted});
await image(s,'assistente-simulada.png',880,205,480,470,'Rascunho fictício da demonstração, com campos revisáveis');

s=await slide(oldNotes[7],{hidden:true});title(s,'Agenda visual por serviço');
await image(s,'agenda-clara.png',80,235,1280,420,'Post-its reais da agenda em modo demo, com dados fictícios');
text(s,'Horário, cliente, serviço e situação do pagamento',90,697,1020,38,26,{color:muted});

s=await slide(oldNotes[8],{hidden:true});title(s,'O que falta comprar para atender');
await image(s,'estoque-claro.png',80,225,1280,415,'Pomada e Mousse na lista da demo, com opção de definir preço');
text(s,'Demanda e estoque calculam a falta. O preço informa a previsão.',90,693,1100,67,25,{color:muted});

s=await slide('PLANO B. Captura real do protótipo, com dados fictícios. O atendimento tem valor combinado de R$ 300, recebeu R$ 50 e mantém R$ 250 pendentes. O custo estimado de R$ 60 é separado do caixa e a sobra prevista não equivale a lucro. Não apresentar esta imagem como demonstração ao vivo. Nenhuma estatística de impacto real no salão foi medida.',{hidden:true});title(s,'O sinal entrou. O restante ficou pendente.');
text(s,'R$ 50 recebidos',100,307,720,82,56,{center:true,bold:true,color:pink});
text(s,'R$ 250 a receber',100,417,720,82,56,{center:true,bold:true});
text(s,'Captura do protótipo com dados fictícios',100,576,720,70,25,{center:true,color:muted});
await image(s,'pagamento-parcial.png',875,205,480,470,'Registro fictício do atendimento e do pagamento parcial');

const candidate=path.join(staging,'candidate.pptx');
await (await PresentationFile.exportPptx(presentation)).save(candidate);
for(const [i,s] of presentation.slides.items.entries()){
 const b=await presentation.export({slide:s,format:'png',scale:1});await fs.writeFile(path.join(staging,`slide-${String(i+1).padStart(2,'0')}.png`),new Uint8Array(await b.arrayBuffer()));
}
await fs.writeFile(path.join(staging,'notes.md'),presentation.slides.items.map((s,i)=>`# Slide ${i+1}\n\n${s.speakerNotes.text}`).join('\n\n'));
await finalizePresentation({workspaceDir:root,candidatePath:candidate,finalPath,pythonExecutable:path.join(runtime,'python/python.exe'),integrityValidatorPath:path.join(skill,'container_tools/inspect_presentation_package_integrity.py'),layoutValidatorPath:path.join(skill,'container_tools/inspect_presentation_layout_geometry.py'),layoutArgs:['--expected-slide-size-emu','13716000,7715250','--validate-bullet-geometry','--validate-heading-fit','--require-native-table-slide','6'],explicitTotalSlideCount:10,requiredNativeTableOwnerSlides:[6],requiredNativeChartOwnerSlides:[],fontPolicy:{basis:'reference',families:['Inter18pt'],referencePath,referenceSha256},verifyArtifactToolImport:true,receiptPath:path.join(staging,'validation.json')});
console.log(JSON.stringify({finalPath,slides:10,visibleSlides:5,validated:true}));
