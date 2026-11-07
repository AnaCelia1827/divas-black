// @vitest-environment jsdom
import { useRef, useState } from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TextAssistant } from '../components/text-assistant';
import { createSeedData } from '../lib/seed';
import { applyCommand } from '../lib/domain';
import { MESSAGE_EXAMPLE } from '../lib/text-draft';
import { fields } from './text-fixtures';
import type { AppData, Command } from '../lib/types';
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function Harness({ saved }: { saved: (data: AppData, command: Command) => void }) {
 const [data, setData] = useState(() => createSeedData(new Date('2026-11-07T15:00:00Z')));
 const latest = useRef(data);
 return <TextAssistant data={data} busy={false} open={vi.fn()} execute={async command => {
  latest.current = applyCommand(latest.current, command); setData(latest.current); saved(latest.current, command); return true;
 }}/>;
}
describe('assistente por texto', () => {
 it('organiza o exemplo, exige horário e confirma sem criar recebimento', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ extraction: fields }))); vi.stubGlobal('fetch', fetcher);
  const saved = vi.fn(); const user = userEvent.setup(); render(<Harness saved={saved}/>);
  await user.click(screen.getByRole('button', { name: 'Usar exemplo' }));
  expect((screen.getByLabelText('Mensagem do atendimento') as HTMLTextAreaElement).value).toBe(MESSAGE_EXAMPLE);
  await user.click(screen.getByRole('button', { name: 'Organizar mensagem' }));
  const hour = await screen.findByLabelText('Horário do atendimento');
  const confirm = screen.getByRole('button', { name: 'Confirmar atendimento na agenda' }) as HTMLButtonElement;
  expect((hour as HTMLInputElement).value).toBe(''); expect(confirm.disabled).toBe(true);
  expect((screen.getByLabelText('Valor total · R$') as HTMLInputElement).value).toBe('200.00');
  expect((screen.getByLabelText('Entrada combinada · R$') as HTMLInputElement).value).toBe('80.00');
  expect((screen.getByLabelText('Valor final combinado · R$') as HTMLInputElement).value).toBe('120.00');
  expect((screen.getByLabelText('Cadastro do serviço') as HTMLSelectElement).value).toBe('__new__');
  await user.type(hour, '20:00');
  const final = screen.getByLabelText('Valor final combinado · R$');
  await user.clear(final); await user.type(final, '130');
  expect(screen.getByRole('alert').textContent).toContain('não somam'); expect(confirm.disabled).toBe(true);
  await user.clear(final); await user.type(final, '120'); expect(confirm.disabled).toBe(false);
  await user.click(confirm);
  await screen.findByText('Atendimento adicionado à agenda');
  expect(saved).toHaveBeenCalledTimes(2);
  const [result, command] = saved.mock.calls[1] as [AppData, Command];
  expect(command.type).toBe('confirmTextDraft');
  expect(result.appointments.at(-1)).toMatchObject({ serviceName: 'trança boxeadora', priceCents: 20000 });
  expect(result.cashMovements).toEqual(saved.mock.calls[0][0].cashMovements);
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ message: MESSAGE_EXAMPLE });
 });
 it('mantém o texto após falha de análise e permite tentar novamente', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'Tente novamente.' }), { status: 503 })));
  const user = userEvent.setup(); const saved = vi.fn(); render(<Harness saved={saved}/>);
  await user.click(screen.getByRole('button', { name: 'Usar exemplo' })); await user.click(screen.getByRole('button', { name: 'Organizar mensagem' }));
  await screen.findByRole('alert');
  expect((screen.getByLabelText('Mensagem do atendimento') as HTMLTextAreaElement).value).toBe(MESSAGE_EXAMPLE);
  expect(saved).not.toHaveBeenCalled(); expect((screen.getByRole('button', { name: 'Organizar mensagem' }) as HTMLButtonElement).disabled).toBe(false);
 });
 it('reaproveita cliente e serviço existentes sem enviar campos internos de cadastro', async () => {
  const seed = createSeedData(new Date('2026-11-07T15:00:00Z'));
  const existing = { ...fields, clientName: seed.clients[0].name, serviceName: seed.services[0].name, time: '20:00', warnings: [] };
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ extraction: existing }))));
  const user = userEvent.setup(); const saved = vi.fn(); render(<Harness saved={saved}/>);
  await user.click(screen.getByRole('button', { name: 'Usar exemplo' })); await user.click(screen.getByRole('button', { name: 'Organizar mensagem' }));
  await screen.findByLabelText('Horário do atendimento');
  expect((screen.getByLabelText('Cadastro da cliente') as HTMLSelectElement).value).toBe(seed.clients[0].id);
  await user.click(screen.getByRole('button', { name: 'Confirmar atendimento na agenda' }));
  await screen.findByText('Atendimento adicionado à agenda');
  const [result, command] = saved.mock.calls[1];
  expect(command.client).not.toHaveProperty('createdAt');
  expect(result.clients).toHaveLength(seed.clients.length); expect(result.services).toHaveLength(seed.services.length);
 });
 it('reenvia o mesmo rascunho após falha de gravação sem cobrar outra análise', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ extraction: fields }))); vi.stubGlobal('fetch', fetcher);
  const execute = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  const user = userEvent.setup(); render(<TextAssistant data={createSeedData()} busy={false} open={vi.fn()} execute={execute}/>);
  await user.click(screen.getByRole('button', { name: 'Usar exemplo' })); await user.click(screen.getByRole('button', { name: 'Organizar mensagem' }));
  const retry = await screen.findByRole('button', { name: 'Tentar salvar rascunho' });
  await user.click(retry); await waitFor(() => expect(execute).toHaveBeenCalledTimes(2));
  expect(fetcher).toHaveBeenCalledOnce(); expect(execute.mock.calls[0][0]).toEqual(execute.mock.calls[1][0]);
 });
});
