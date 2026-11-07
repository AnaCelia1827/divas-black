import { describe, expect, it } from 'vitest';
import { applyCommand, getAppointmentBalance } from '../lib/domain';
import { parseAppData } from '../lib/validation';
import { createDemoRepository } from '../lib/repository';
import { createSeedData } from '../lib/seed';
import { confirmCommand, draft } from './text-fixtures';
const seed = () => createSeedData(new Date('2026-11-07T15:00:00Z'));
const saved = () => applyCommand(seed(), { commandId: 'save-text', type: 'saveTextDraft', draft: draft() });
describe('rascunho de texto e confirmação', () => {
 it('persiste original e valores estruturados sem criar agenda, cliente, serviço ou caixa', async () => {
  const storage = new Map<string, string>();
  const repository = createDemoRepository({ getItem: key => storage.get(key) ?? null, setItem: (key, value) => { storage.set(key, value); } });
  const before = await repository.load();
  await repository.execute({ commandId: 'save-text', type: 'saveTextDraft', draft: draft() });
  const after = await repository.load();
  expect(after.drafts.at(-1)).toEqual(draft());
  for (const key of ['appointments', 'clients', 'services', 'cashMovements'] as const) expect(after[key]).toEqual(before[key]);
  expect(parseAppData(JSON.parse(JSON.stringify(after)))).toEqual(after);
 });
 it('confirma cliente, serviço exato e agenda uma única vez sem antecipar recebimento', () => {
  const before = saved(); const command = confirmCommand(); const after = applyCommand(before, command);
  expect(after.clients.at(-1)?.name).toBe('Maria'); expect(after.services.at(-1)?.name).toBe('trança boxeadora');
  expect(after.appointments.at(-1)).toMatchObject({ id: 'text-appointment', serviceName: 'trança boxeadora', priceCents: 20000, status: 'confirmed' });
  expect(after.appointments.at(-1)?.notes).toContain('Entrada combinada: R$');
  expect(after.cashMovements).toEqual(before.cashMovements); expect(getAppointmentBalance(after, 'text-appointment')).toBe(20000);
  expect(after.drafts.at(-1)).toMatchObject({ confirmedAppointmentId: 'text-appointment', reviewed: { time: '20:00', depositCents: 8000, finalCents: 12000 } });
  expect(applyCommand(after, command)).toBe(after);
  expect(() => applyCommand(after, { ...command, commandId: 'another-confirm' })).toThrow('já foi confirmada');
 });
 it('conflito de horário não salva cadastros parciais nem confirma o rascunho', () => {
  const before = saved(); const copy = structuredClone(before); const command = confirmCommand();
  command.appointment.startAt = '2026-11-07T13:00:00-03:00'; command.review.time = '13:00';
  expect(() => applyCommand(before, command)).toThrow('ocupado'); expect(before).toEqual(copy);
 });
 it('exige horário e valores coerentes na confirmação e preserva os cadastros existentes', () => {
  const before = saved(); const command = confirmCommand();
  expect(() => applyCommand(before, { ...command, review: { ...command.review, time: null } })).toThrow('Complete');
  expect(() => applyCommand(before, { ...command, review: { ...command.review, finalCents: 13000 } })).toThrow('não somam');
  const { createdAt: _createdAt, ...client } = before.clients[0]; const service = before.services[0];
  const after = applyCommand(before, { ...command, client: { ...client, name: 'Não sobrescrever' }, service: { ...service, priceCents: 1 }, appointment: { ...command.appointment, clientId: client.id, serviceId: service.id } });
  expect(after.clients).toEqual(before.clients); expect(after.services).toEqual(before.services);
 });
});
