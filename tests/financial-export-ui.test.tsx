// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CashScreen } from '../components/screens';
import { createSeedData } from '../lib/seed';
import { downloadFinancialSpreadsheet } from '../lib/financial-xlsx';
vi.mock('../lib/financial-xlsx',()=>({downloadFinancialSpreadsheet:vi.fn()}));
const data=createSeedData(new Date('2026-11-07T15:00:00Z'));
beforeEach(()=>{vi.clearAllMocks();vi.mocked(downloadFinancialSpreadsheet).mockResolvedValue(undefined);});
afterEach(cleanup);
describe('exportação financeira no Caixa',()=>{
 it('envia o período, categoria e tipo selecionados para a planilha',async()=>{
  const user=userEvent.setup();render(<CashScreen data={data} open={vi.fn()} mode="demo"/>);
  const month=screen.getByLabelText('Mês');await user.clear(month);await user.type(month,'2026-11');
  await user.selectOptions(screen.getByLabelText('Movimento'),'out');await user.selectOptions(screen.getByLabelText('Categoria'),'Contas');
  await user.click(screen.getByRole('button',{name:'Exportar planilha'}));
  await waitFor(()=>expect(downloadFinancialSpreadsheet).toHaveBeenCalledExactlyOnceWith(data,{from:'2026-11-01',to:'2026-11-30',direction:'out',category:'Contas',mode:'demo'}));
 });
 it('bloqueia cliques repetidos enquanto gera o Excel',async()=>{
  const user=userEvent.setup();let finish!:()=>void;
  vi.mocked(downloadFinancialSpreadsheet).mockImplementation(()=>new Promise<void>(resolve=>{finish=resolve;}));
  render(<CashScreen data={data} open={vi.fn()} mode="demo"/>);
  await user.dblClick(screen.getByRole('button',{name:'Exportar planilha'}));
  expect(downloadFinancialSpreadsheet).toHaveBeenCalledTimes(1);
  expect((screen.getByRole('button',{name:'Gerando planilha…'}) as HTMLButtonElement).disabled).toBe(true);
  await act(async()=>{finish();});
  expect((screen.getByRole('button',{name:'Exportar planilha'}) as HTMLButtonElement).disabled).toBe(false);
 });
 it('mostra falha e permite tentar exportar novamente',async()=>{
  const user=userEvent.setup();vi.mocked(downloadFinancialSpreadsheet).mockRejectedValueOnce(new Error('Não foi possível gerar a planilha.'));
  render(<CashScreen data={data} open={vi.fn()} mode="demo"/>);
  await user.click(screen.getByRole('button',{name:'Exportar planilha'}));
  expect((await screen.findByRole('alert')).textContent).toContain('Não foi possível gerar a planilha.');
  await user.click(screen.getByRole('button',{name:'Exportar planilha'}));
  await waitFor(()=>expect(downloadFinancialSpreadsheet).toHaveBeenCalledTimes(2));
  expect(screen.queryByRole('alert')).toBeNull();
 });
 it('desabilita exportação quando as datas do período estão invertidas',async()=>{
  const user=userEvent.setup();render(<CashScreen data={data} open={vi.fn()} mode="demo"/>);
  await user.click(screen.getByRole('button',{name:'Escolher período'}));
  await user.clear(screen.getByLabelText('De'));await user.type(screen.getByLabelText('De'),'2026-12-10');
  await user.clear(screen.getByLabelText('Até'));await user.type(screen.getByLabelText('Até'),'2026-12-01');
  expect((screen.getByRole('button',{name:'Exportar planilha'}) as HTMLButtonElement).disabled).toBe(true);
  expect(downloadFinancialSpreadsheet).not.toHaveBeenCalled();
 });
});
