// @vitest-environment jsdom
import { useRef, useState } from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OperationPanel, type Operation } from '../components/operation-panel';
import { createSeedData } from '../lib/seed';
import { applyCommand } from '../lib/domain';
import type { Command } from '../lib/types';

afterEach(cleanup);
const seed = () => createSeedData(new Date('2026-11-07T15:00:00Z'));
function Harness({operation, saved, closed = vi.fn()}:{operation:Operation;saved:(command:Command)=>void;closed?:()=>void}) {
 const [data,setData]=useState(seed); const [error,setError]=useState<string|null>(null);
 const latest=useRef(data);
 return <OperationPanel operation={operation} data={data} busy={false} error={error} onClose={closed} onCommand={async command=>{try {latest.current=applyCommand(latest.current,command);setData(latest.current);saved(command);setError(null);return true;}catch(error){setError((error as Error).message);return false;}}}/>;
}
describe('formulários rápidos',()=>{
 it('cadastra cliente com nome e celular opcional',async()=>{
  const user=userEvent.setup();const saved=vi.fn();const closed=vi.fn();
  render(<Harness operation={{kind:'client'}} saved={saved} closed={closed}/>);
  await user.type(screen.getByLabelText('Nome'),'Aline de teste');
  await user.click(screen.getByRole('button',{name:'Salvar'}));
  expect(saved).toHaveBeenCalledWith(expect.objectContaining({type:'saveClient',client:expect.objectContaining({name:'Aline de teste',phone:'',active:true})}));
  expect(closed).toHaveBeenCalledOnce();
 });
 it('cadastra cliente dentro do agendamento sem transformar previsão em recebimento',async()=>{
  const user=userEvent.setup();const saved=vi.fn();
  render(<Harness operation={{kind:'appointment',date:'2026-12-10'}} saved={saved}/>);
  await user.selectOptions(screen.getByLabelText('Cliente'),'__new__');
  await user.type(screen.getByLabelText('Nome da nova cliente'),'Nova cliente inline');
  await user.click(screen.getByRole('button',{name:'Agendar atendimento'}));
  await waitFor(()=>expect(saved).toHaveBeenCalledTimes(2));
  expect(saved.mock.calls[0][0].type).toBe('saveClient');
  expect(saved.mock.calls[1][0]).toMatchObject({type:'saveAppointment',appointment:{clientId:saved.mock.calls[0][0].client.id,priceCents:32000}});
 });
 it('concluir pede confirmação antes de registrar o restante como recebido',async()=>{
  const user=userEvent.setup();const saved=vi.fn();const appointment=seed().appointments.find(a=>a.status==='confirmed')!;
  render(<Harness operation={{kind:'appointmentDetail',appointment}} saved={saved}/>);
  await user.click(screen.getByRole('button',{name:'Concluir atendimento'}));
  await screen.findByRole('heading',{name:'Registrar entrada'});
  expect(saved).toHaveBeenCalledTimes(1);
  expect(saved.mock.calls[0][0]).toMatchObject({type:'setAppointmentStatus',status:'completed'});
  await user.click(screen.getByRole('button',{name:'Confirmar recebimento'}));
  await waitFor(()=>expect(saved).toHaveBeenCalledTimes(2));
  expect(saved.mock.calls[1][0]).toMatchObject({type:'recordCash',movement:{appointmentId:appointment.id,direction:'in',amountCents:9000}});
 });
 it('preserva a cliente criada quando o horário conflita e permite corrigir só o agendamento',async()=>{
  const user=userEvent.setup();const saved=vi.fn();
  render(<Harness operation={{kind:'appointment',date:'2026-11-07'}} saved={saved}/>);
  await user.selectOptions(screen.getByLabelText('Cliente'),'__new__');
  await user.type(screen.getByLabelText('Nome da nova cliente'),'Cliente que permanece');
  await user.click(screen.getByRole('button',{name:'Agendar atendimento'}));
  expect((await screen.findByRole('alert')).textContent).toContain('ocupado');
  expect(saved).toHaveBeenCalledTimes(1);
  expect(screen.queryByLabelText('Nome da nova cliente')).toBeNull();
  expect((screen.getByLabelText('Cliente') as HTMLSelectElement).value).toBe(saved.mock.calls[0][0].client.id);
  await user.clear(screen.getByLabelText('Dia'));await user.type(screen.getByLabelText('Dia'),'2026-12-10');
  await user.click(screen.getByRole('button',{name:'Agendar atendimento'}));
  await waitFor(()=>expect(saved).toHaveBeenCalledTimes(2));
  expect(saved.mock.calls[1][0].type).toBe('saveAppointment');
 });
 it('registra compra a partir da quantidade sugerida na lista',async()=>{
  const user=userEvent.setup();const saved=vi.fn();
  render(<Harness operation={{kind:'stock',materialId:'mat-fibra',stockKind:'purchase',quantity:3}} saved={saved}/>);
  expect((screen.getByLabelText('Quantidade') as HTMLInputElement).value).toBe('3');
  await user.type(screen.getByLabelText('Valor total pago · R$'),'90');
  await user.click(screen.getByRole('button',{name:'Registrar compra'}));
  expect(saved).toHaveBeenCalledWith(expect.objectContaining({type:'recordStock',movement:expect.objectContaining({materialId:'mat-fibra',kind:'purchase',quantity:3,costCents:9000})}));
 });
 it('mostra erro de saldo excedido dentro do painel',async()=>{
  const user=userEvent.setup();const saved=vi.fn();const appointment=seed().appointments.find(a=>a.status==='confirmed')!;
  render(<Harness operation={{kind:'cash',direction:'in',appointmentId:appointment.id}} saved={saved}/>);
  const input=screen.getByLabelText('Quanto recebeu? · R$');await user.clear(input);await user.type(input,'9999');
  await user.click(screen.getByRole('button',{name:'Confirmar recebimento'}));
  expect((await screen.findByRole('alert')).textContent).toContain('maior que o saldo');
  expect(saved).not.toHaveBeenCalled();
 });
 it('abre com foco protegido e permite fechar pelo teclado',async()=>{
  const user=userEvent.setup();const closed=vi.fn();
  render(<Harness operation={{kind:'client'}} saved={vi.fn()} closed={closed}/>);
  expect(document.activeElement).toBe(screen.getByRole('dialog'));
  await user.keyboard('{Escape}');expect(closed).toHaveBeenCalledOnce();
 });
 it('salva o custo estimado no serviço como estimativa',async()=>{
  const user=userEvent.setup();const saved=vi.fn();
  render(<Harness operation={{kind:'service',service:seed().services[0]}} saved={saved}/>);
  const cost=screen.getByLabelText('Custo estimado · R$');await user.clear(cost);await user.type(cost,'80');
  await user.click(screen.getByRole('button',{name:'Salvar'}));
  expect(saved).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({type:'saveService',service:expect.objectContaining({costCents:8000,priceCents:32000})}));
 });
 it('editar um material preserva demanda extra e presença fixa na lista',async()=>{
  const user=userEvent.setup();const saved=vi.fn();
  render(<Harness operation={{kind:'material',material:{...seed().materials[0],manualDemand:3,alwaysOnShoppingList:true}}} saved={saved}/>);
  await user.click(screen.getByRole('button',{name:'Salvar'}));
  expect(saved).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({type:'saveMaterial',material:expect.objectContaining({manualDemand:3,alwaysOnShoppingList:true})}));
 });
});
