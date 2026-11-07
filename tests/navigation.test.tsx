// @vitest-environment jsdom
import { cleanup, render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Page from '../app/page';
import { DEMO_STORAGE_KEY } from '../lib/repository';
import type { AppData } from '../lib/types';

const navigate=async(user:ReturnType<typeof userEvent.setup>,name:string)=>user.click(within(screen.getByRole('navigation',{name:'Principal'})).getByRole('button',{name}));
beforeEach(()=>{
 localStorage.clear();
 vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({mode:'demo',data:null}))));
 vi.stubGlobal('matchMedia',vi.fn(()=>({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()})));
 vi.spyOn(window,'scrollTo').mockImplementation(()=>{});
});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});

describe('navegação e fluxos do aplicativo',()=>{
 it('edita preços de Pomada e Mousse, preserva ao reabrir e sugere total da compra ajustável',async()=>{
  const user=userEvent.setup();const first=render(<Page/>);await screen.findByRole('heading',{name:/^Oi, Diva\./});
  await navigate(user,'Materiais');
  const initial=JSON.parse(localStorage.getItem(DEMO_STORAGE_KEY)!) as AppData;
  for(const [name,unit,price] of [['Pomada','pote','25.90'],['Mousse','frasco','32.50']]){
   await user.click(screen.getByRole('button',{name:`Definir preço de ${name}`}));
   const dialog=within(screen.getByRole('dialog'));
   await user.type(dialog.getByLabelText(`Preço por ${unit} · R$`),price);
   await user.click(dialog.getByRole('button',{name:'Salvar preço'}));
   await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());
  }
  first.unmount();render(<Page/>);await screen.findByRole('heading',{name:/^Oi, Diva\./});await navigate(user,'Materiais');
  expect(screen.getByRole('button',{name:'Editar preço de Mousse'})).toBeDefined();
  const priceButton=screen.getByRole('button',{name:'Editar preço de Pomada'});const card=within(priceButton.closest('article')!);
  expect(card.getByText(/Compra prevista: R\$\s*25,90/)).toBeDefined();
  await user.click(card.getByRole('button',{name:'Registrar compra'}));
  expect((screen.getByLabelText('Valor total pago · R$') as HTMLInputElement).value).toBe('25.90');
  await user.clear(screen.getByLabelText('Quantidade'));await user.type(screen.getByLabelText('Quantidade'),'2');
  expect((screen.getByLabelText('Valor total pago · R$') as HTMLInputElement).value).toBe('51.80');
  await user.clear(screen.getByLabelText('Valor total pago · R$'));await user.type(screen.getByLabelText('Valor total pago · R$'),'48');
  await user.click(within(screen.getByRole('dialog')).getByRole('button',{name:'Registrar compra'}));
  await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());
  const saved=JSON.parse(localStorage.getItem(DEMO_STORAGE_KEY)!) as AppData;
  expect(saved.materials.find(m=>m.id==='mat-pomada')).toMatchObject({unitPriceCents:2590,quantity:2,alwaysOnShoppingList:true});
  expect(saved.materials.find(m=>m.id==='mat-mousse')?.unitPriceCents).toBe(3250);
  expect(saved.cashMovements).toHaveLength(initial.cashMovements.length+1);
  expect(saved.cashMovements.at(-1)?.amountCents).toBe(4800);
 });
 it('abre as sete telas sem atalhos sem destino',async()=>{
  const user=userEvent.setup();render(<Page/>);
  await screen.findByRole('heading',{name:/^Oi, Diva\./});
  await navigate(user,'Clientes');expect(screen.getByRole('textbox',{name:'Buscar nome ou celular'})).toBeDefined();
  await navigate(user,'Serviços');expect(screen.getByRole('textbox',{name:'Buscar serviço'})).toBeDefined();
  await navigate(user,'Caixa');expect(screen.getByRole('heading',{name:'Movimentações'})).toBeDefined();
  await navigate(user,'Materiais');expect(screen.getByRole('heading',{name:/Preciso comprar/})).toBeDefined();
  await navigate(user,'Assistente');expect(screen.getByRole('button',{name:'Revisar e agendar'})).toBeDefined();
  await navigate(user,'Agenda');expect(screen.getByRole('button',{name:'Semana'})).toBeDefined();
 });
 it('cadastra cliente pela tela e encontra o dado salvo na busca',async()=>{
  const user=userEvent.setup();render(<Page/>);await screen.findByRole('heading',{name:/^Oi, Diva\./});
  await navigate(user,'Clientes');await user.click(screen.getByRole('button',{name:'Nova cliente'}));
  await user.type(screen.getByLabelText('Nome'),'Cliente nova da navegação');
  await user.click(screen.getByRole('button',{name:'Salvar'}));
  await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());
  await user.type(screen.getByRole('textbox',{name:'Buscar nome ou celular'}),'Cliente nova da navegação');
  expect(screen.getByText('Cliente nova da navegação')).toBeDefined();
  const saved=JSON.parse(localStorage.getItem(DEMO_STORAGE_KEY)!) as AppData;
  expect(saved.clients.some(c=>c.name==='Cliente nova da navegação')).toBe(true);
 });
 it('a lista de compras abre material e quantidade sugeridos',async()=>{
  const user=userEvent.setup();render(<Page/>);await screen.findByRole('heading',{name:/^Oi, Diva\./});
  await navigate(user,'Materiais');await user.click(screen.getAllByRole('button',{name:'Registrar compra'})[0]);
  expect(screen.getByRole('dialog')).toBeDefined();
  expect(Number((screen.getByLabelText('Quantidade') as HTMLInputElement).value)).toBeGreaterThan(0);
  expect((screen.getByLabelText('Material') as HTMLSelectElement).value).not.toBe('');
 });
 it('confirma rascunho uma vez e mostra o atendimento criado',async()=>{
  const user=userEvent.setup();render(<Page/>);await screen.findByRole('heading',{name:/^Oi, Diva\./});
  await navigate(user,'Assistente');await user.click(screen.getByRole('button',{name:'Revisar e agendar'}));
  await user.click(screen.getByRole('button',{name:'Confirmar na agenda'}));
  await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());
  expect(screen.getByText('Adicionado à agenda')).toBeDefined();
  const saved=JSON.parse(localStorage.getItem(DEMO_STORAGE_KEY)!) as AppData;
  expect(saved.appointments.filter(a=>a.draftId==='draft-1')).toHaveLength(1);
  expect(screen.queryByRole('button',{name:'Revisar e agendar'})).toBeNull();
 });
 it('navega entre meses da agenda sem alterar o filtro do painel',async()=>{
  const user=userEvent.setup();render(<Page/>);await screen.findByRole('heading',{name:/^Oi, Diva\./});
  const month=(screen.getByLabelText('Mês do resumo') as HTMLInputElement).value;
  await navigate(user,'Agenda');await user.click(screen.getByRole('button',{name:'Mês'}));
  await user.click(screen.getByRole('button',{name:'Próximo período'}));
  const selected=(screen.getByLabelText('Ir para data') as HTMLInputElement).value;
  expect(selected.slice(0,7)).not.toBe(month);
  await navigate(user,'Início');expect((screen.getByLabelText('Mês do resumo') as HTMLInputElement).value).toBe(month);
 });
 it('no celular abre a agenda diária e permite acessar serviços pelo Mais',async()=>{
  vi.stubGlobal('matchMedia',vi.fn(()=>({matches:true,addEventListener:vi.fn(),removeEventListener:vi.fn()})));
  const user=userEvent.setup();render(<Page/>);await screen.findByRole('heading',{name:/^Oi, Diva\./});
  const mobile=within(screen.getByRole('navigation',{name:'Navegação celular'}));
  await user.click(mobile.getByRole('button',{name:'Agenda'}));
  expect(screen.getByRole('button',{name:'Dia',pressed:true})).toBeDefined();
  await user.click(mobile.getByRole('button',{name:'Mais'}));
  await user.click(within(screen.getByRole('navigation',{name:'Mais páginas'})).getByRole('button',{name:'Serviços'}));
  expect(screen.getByRole('textbox',{name:'Buscar serviço'})).toBeDefined();
  expect(screen.queryByRole('navigation',{name:'Mais páginas'})).toBeNull();
 });
 it('filtra o resumo por intervalo e trata datas invertidas sem quebrar a tela',async()=>{
  const user=userEvent.setup();render(<Page/>);await screen.findByRole('heading',{name:/^Oi, Diva\./});
  await user.click(screen.getByRole('button',{name:'Período'}));
  const from=screen.getByLabelText('Início do resumo');const to=screen.getByLabelText('Fim do resumo');
  await user.clear(from);await user.type(from,'2099-01-01');await user.clear(to);await user.type(to,'2099-01-10');
  expect(screen.queryByRole('alert')).toBeNull();
  expect(screen.getByText('Recebi no período').closest('article')?.textContent).toMatch(/R\$\s*0,00/);
  await user.clear(to);await user.type(to,'2098-12-01');
  expect(screen.getByRole('alert').textContent).toContain('Confira o período');
  expect(screen.getByRole('heading',{name:/^Oi, Diva\./})).toBeDefined();
 });
 it('adiciona custo manual pelo Início e registra o valor como saída',async()=>{
  const user=userEvent.setup();render(<Page/>);await screen.findByRole('heading',{name:/^Oi, Diva\./});
  await user.click(screen.getByRole('button',{name:'Adicionar custo'}));
  const dialog=within(screen.getByRole('dialog'));
  expect(dialog.getByRole('heading',{name:'Adicionar custo'})).toBeDefined();
  await user.type(dialog.getByLabelText('Quanto pagou? · R$'),'42.50');
  await user.type(dialog.getByLabelText('Descrição · opcional'),'Custo de energia de teste');
  await user.click(dialog.getByRole('button',{name:'Confirmar saída'}));
  await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());
  const saved=JSON.parse(localStorage.getItem(DEMO_STORAGE_KEY)!) as AppData;
  expect(saved.cashMovements.some(m=>m.direction==='out'&&m.amountCents===4250&&m.description==='Custo de energia de teste')).toBe(true);
 });
 it('salva o modo escuro e recupera a preferência ao reabrir',async()=>{
  const user=userEvent.setup();const first=render(<Page/>);await screen.findByRole('heading',{name:/^Oi, Diva\./});
  await user.click(screen.getByRole('button',{name:'Ativar modo escuro'}));
  expect(document.documentElement.dataset.theme).toBe('dark');expect(localStorage.getItem('divas-black:theme')).toBe('dark');
  first.unmount();render(<Page/>);await screen.findByRole('heading',{name:/^Oi, Diva\./});
  expect(document.documentElement.dataset.theme).toBe('dark');
  await user.click(screen.getByRole('button',{name:'Ativar modo claro'}));expect(document.documentElement.dataset.theme).toBe('light');
 });
 it('adiciona demanda manual à lista sem alterar estoque ou caixa',async()=>{
  const user=userEvent.setup();render(<Page/>);await screen.findByRole('heading',{name:/^Oi, Diva\./});
  await navigate(user,'Materiais');await user.click(screen.getByRole('button',{name:'Adicionar demanda'}));
  await user.selectOptions(screen.getByLabelText('Material da lista'),'__new__');
  await user.type(screen.getByLabelText('Nome do material'),'Fibra castanha extra');
  await user.clear(screen.getByLabelText('Demanda extra'));await user.type(screen.getByLabelText('Demanda extra'),'2');
  const before=JSON.parse(localStorage.getItem(DEMO_STORAGE_KEY)!) as AppData;
  await user.click(screen.getByRole('button',{name:'Atualizar lista'}));await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());
  const after=JSON.parse(localStorage.getItem(DEMO_STORAGE_KEY)!) as AppData;
  expect(after.materials.find(m=>m.name==='Fibra castanha extra')).toMatchObject({manualDemand:2,quantity:0});
  expect(after.cashMovements).toHaveLength(before.cashMovements.length);
  expect(screen.getAllByText('Fibra castanha extra').length).toBeGreaterThan(0);
  expect(screen.getByRole('button',{name:'Baixar PDF'})).toBeDefined();
 });
 it('retrai e expande o menu preservando a preferência ao reabrir',async()=>{
  const user=userEvent.setup();const first=render(<Page/>);await screen.findByRole('heading',{name:/^Oi, Diva\./});
  await user.click(screen.getByRole('button',{name:'Retrair menu'}));
  expect(screen.getByRole('button',{name:'Expandir menu'})).toBeDefined();
  first.unmount();render(<Page/>);await screen.findByRole('heading',{name:/^Oi, Diva\./});
  await user.click(screen.getByRole('button',{name:'Expandir menu'}));
  expect(screen.getByRole('button',{name:'Retrair menu'})).toBeDefined();
 });
});
