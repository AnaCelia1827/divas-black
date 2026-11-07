import { describe, expect, it } from 'vitest';
import { applyCommand, getAppointmentBalance, getAppointmentPaid, getFinancialSummary, getShoppingList } from '../lib/domain';
import { createSeedData } from '../lib/seed';
import { parseAppData, parseCommand } from '../lib/validation';
import type { AppData, Command } from '../lib/types';

const now = new Date('2026-11-07T15:00:00Z');
function empty(): AppData { return { ...createSeedData(now), appointments: [], cashMovements: [], stockMovements: [], drafts: [], appliedCommandIds: [] }; }
function appointment(id = 'booking', startAt = '2026-11-07T09:00:00-03:00'): Command {
  return { commandId: `create-${id}`, type: 'saveAppointment', appointment: { id, clientId: 'client-1', serviceId: 'svc-box', startAt, durationMinutes: 180, priceCents: 30000, notes: '' } };
}
function payment(id: string, amountCents: number): Command { return { commandId: `cash-${id}`, type: 'recordCash', movement: { id, appointmentId: 'booking', direction: 'in', amountCents, date: '2026-11-07', category: 'Serviços', description: '' } }; }

describe('agenda e caixa', () => {
  it('estima a compra pelo preço editável sem modificar despesas anteriores e distingue preço ausente de zero', () => {
    let data = applyCommand(empty(), { commandId: 'pomada-purchase', type: 'recordStock', movement: { id: 'price-purchase', materialId: 'mat-pomada', kind: 'purchase', quantity: 5, costCents: 5000, date: '2026-11-07', notes: '' } }, now);
    const material = data.materials.find(item => item.id === 'mat-pomada')!;
    expect(material.unitPriceCents).toBeUndefined();
    data = applyCommand(data, { commandId: 'pomada-price', type: 'saveMaterial', material: { ...material, manualDemand: 7, unitPriceCents: 2590 } }, now);
    expect(getShoppingList(data, '2026-11-07', '2026-11-14').find(item => item.material.id === material.id)).toMatchObject({ shortage: 3, estimatedCostCents: 7770 });
    expect(parseAppData(JSON.parse(JSON.stringify(data))).materials.find(item => item.id === material.id)?.unitPriceCents).toBe(2590);
    expect(data.cashMovements).toHaveLength(1);
    expect(data.cashMovements[0].amountCents).toBe(5000);
    expect(data.stockMovements[0].costCents).toBe(5000);
    const priced = data.materials.find(item => item.id === material.id)!;
    const free = applyCommand(data, { commandId: 'zero-price', type: 'saveMaterial', material: { ...priced, unitPriceCents: 0 } }, now);
    expect(getShoppingList(free, '2026-11-07', '2026-11-14').find(item => item.material.id === material.id)?.estimatedCostCents).toBe(0);
    const cleared = applyCommand(data, { commandId: 'clear-price', type: 'saveMaterial', material: { ...priced, unitPriceCents: undefined } }, now);
    expect(getShoppingList(cleared, '2026-11-07', '2026-11-14').find(item => item.material.id === material.id)?.estimatedCostCents).toBeUndefined();
    for (const unitPriceCents of [-1, 0.5]) expect(() => parseCommand({ commandId: 'bad-price', type: 'saveMaterial', material: { ...priced, unitPriceCents } })).toThrow();
  });
  it('separa previsão, sinal e restante sem duplicar ao concluir', () => {
    let data = applyCommand(empty(), appointment(), now);
    expect(getFinancialSummary(data, '2026-11-01', '2026-11-30')).toEqual({ received: 0, spent: 0, balance: 0, receivable: 30000 });
    data = applyCommand(data, payment('deposit', 5000), now);
    data = applyCommand(data, { commandId: 'finish', type: 'setAppointmentStatus', appointmentId: 'booking', status: 'completed' }, now);
    expect(getAppointmentBalance(data, 'booking')).toBe(25000);
    expect(data.cashMovements).toHaveLength(1);
    data = applyCommand(data, payment('rest', 25000), now);
    expect(getAppointmentPaid(data, 'booking')).toBe(30000);
    expect(getAppointmentBalance(data, 'booking')).toBe(0);
    expect(getFinancialSummary(data, '2026-11-01', '2026-11-30').received).toBe(30000);
    expect(() => applyCommand(data, payment('excess', 1), now)).toThrow(/maior/);
  });
  it('é idempotente para o mesmo commandId e rejeita outro comando com mesmo pagamento', () => {
    const data = applyCommand(applyCommand(empty(), appointment(), now), payment('one', 5000), now);
    expect(applyCommand(data, payment('one', 5000), now)).toBe(data);
    expect(() => applyCommand(data, { ...payment('one', 5000), commandId: 'different' }, now)).toThrow(/já foi/);
  });
  it('bloqueia sobreposição, permite encostar horários e libera cancelamento', () => {
    let data = applyCommand(empty(), appointment(), now);
    expect(() => applyCommand(data, appointment('overlap', '2026-11-07T11:59:00-03:00'), now)).toThrow(/ocupado/);
    expect(applyCommand(data, appointment('adjacent', '2026-11-07T12:00:00-03:00'), now).appointments).toHaveLength(2);
    data = applyCommand(data, { commandId: 'cancel', type: 'setAppointmentStatus', appointmentId: 'booking', status: 'cancelled' }, now);
    expect(applyCommand(data, appointment('replacement'), now).appointments).toHaveLength(2);
  });
  it('preserva pagamentos no cancelamento e limita o reembolso líquido', () => {
    let data = applyCommand(applyCommand(empty(), appointment(), now), payment('one', 5000), now);
    data = applyCommand(data, { commandId: 'cancel', type: 'setAppointmentStatus', appointmentId: 'booking', status: 'cancelled' }, now);
    expect(getFinancialSummary(data, '2026-11-01', '2026-11-30').receivable).toBe(0);
    data = applyCommand(data, { commandId: 'refund', type: 'refund', appointmentId: 'booking', movementId: 'refund-one', amountCents: 3000, date: '2026-11-07', description: '' }, now);
    expect(getAppointmentPaid(data, 'booking')).toBe(2000);
    expect(() => applyCommand(data, { commandId: 'refund-two', type: 'refund', appointmentId: 'booking', movementId: 'refund-two', amountCents: 3000, date: '2026-11-07', description: '' }, now)).toThrow(/maior/);
  });
  it('usa data efetiva de caixa e data local do atendimento', () => {
    let data = applyCommand(empty(), appointment('booking', '2026-12-01T01:00:00Z'), now);
    data = applyCommand(data, payment('advance', 5000), now);
    expect(getFinancialSummary(data, '2026-11-01', '2026-11-30')).toEqual({ received: 5000, spent: 0, balance: 5000, receivable: 25000 });
    expect(getFinancialSummary(data, '2026-12-01', '2026-12-31').receivable).toBe(0);
  });
  it('preserva preço, nome e receita de um atendimento ao editar serviço', () => {
    let data = applyCommand(empty(), appointment(), now);
    data = applyCommand(data, { commandId: 'edit-service', type: 'saveService', service: { ...data.services[0], name: 'Novo nome', priceCents: 99900, materials: [] } }, now);
    expect(data.appointments[0].serviceName).toBe('Box Braids');
    expect(data.appointments[0].priceCents).toBe(30000);
    expect(data.appointments[0].materials).toHaveLength(2);
  });
  it('concluídos mantêm intervalo ocupado e não podem ser remarcados', () => {
    let data = applyCommand(empty(), appointment(), now);
    data = applyCommand(data, { commandId: 'complete', type: 'setAppointmentStatus', appointmentId: 'booking', status: 'completed' }, now);
    expect(() => applyCommand(data, appointment('collision'), now)).toThrow(/ocupado/);
    const edit = appointment() as Extract<Command, { type: 'saveAppointment' }>;
    expect(() => applyCommand(data, { ...edit, commandId: 'reschedule-completed', appointment: { ...edit.appointment, startAt: '2026-11-08T09:00:00-03:00' } }, now)).toThrow(/concluído/);
  });
  it('remarca sem perder pagamento ou receita original após editar serviço', () => {
    let data = applyCommand(applyCommand(empty(), appointment(), now), payment('deposit', 5000), now);
    data = applyCommand(data, { commandId: 'change-recipe', type: 'saveService', service: { ...data.services[0], materials: [{ materialId: 'mat-fibra', quantity: 9 }] } }, now);
    const edit = appointment() as Extract<Command, { type: 'saveAppointment' }>;
    data = applyCommand(data, { ...edit, commandId: 'reschedule', appointment: { ...edit.appointment, startAt: '2026-11-08T09:00:00-03:00' } }, now);
    expect(data.appointments[0].startAt).toContain('2026-11-08');
    expect(data.appointments[0].materials).toEqual([{ materialId: 'mat-fibra', quantity: 3 }, { materialId: 'mat-gel', quantity: 0.15 }]);
    expect(getAppointmentPaid(data, 'booking')).toBe(5000);
    expect(getAppointmentBalance(data, 'booking')).toBe(25000);
    expect(data.cashMovements).toHaveLength(1);
  });
  it('arquiva cliente e serviço preservando histórico e bloqueia novos agendamentos', () => {
    let data = applyCommand(empty(), appointment(), now);
    const { createdAt: _createdAt, ...client } = data.clients[0];
    data = applyCommand(data, { commandId: 'archive-client', type: 'saveClient', client: { ...client, active: false } }, now);
    data = applyCommand(data, { commandId: 'archive-service', type: 'saveService', service: { ...data.services[0], active: false } }, now);
    expect(data.appointments[0]).toMatchObject({ clientId: client.id, serviceName: 'Box Braids', priceCents: 30000 });
    expect(parseAppData(data).appointments).toHaveLength(1);
    expect(() => applyCommand(data, appointment('new', '2026-11-08T09:00:00-03:00'), now)).toThrow(/ativa/);
    const activeClientData = applyCommand(data, { commandId: 'restore-client', type: 'saveClient', client: { ...client, active: true } }, now);
    expect(() => applyCommand(activeClientData, appointment('new', '2026-11-08T09:00:00-03:00'), now)).toThrow(/ativo/);
  });
  it('confirma draft uma vez e bloqueia outra confirmação mesmo com comando diferente', () => {
    const initial = empty();
    initial.drafts = createSeedData(now).drafts;
    const base = appointment() as Extract<Command, { type: 'saveAppointment' }>;
    const confirm: Command = { ...base, appointment: { ...base.appointment, draftId: initial.drafts[0].id } };
    const data = applyCommand(initial, confirm, now);
    expect(data.drafts[0].confirmedAppointmentId).toBe('booking');
    expect(applyCommand(data, confirm, now).appointments).toHaveLength(1);
    expect(() => applyCommand(data, { ...confirm, commandId: 'confirm-again', appointment: { ...confirm.appointment, id: 'another', startAt: '2026-11-08T09:00:00-03:00' } }, now)).toThrow(/já foi confirmada/);
    expect(data.appointments).toHaveLength(1);
  });
});

describe('materiais e lista de compra', () => {
  it('soma demanda manual à agenda e persiste a quantidade sem alterar estoque ou caixa', () => {
    let data = applyCommand(empty(), appointment(), now);
    data = applyCommand(data, { commandId: 'manual-demand', type: 'saveMaterial', material: { ...data.materials[0], minimum: 0, manualDemand: 4 } }, now);
    expect(getShoppingList(data, '2026-11-07', '2026-11-14').find(item => item.material.id === 'mat-fibra')).toMatchObject({ demand: 7, shortage: 2 });
    expect(parseAppData(data).materials[0].manualDemand).toBe(4);
    expect(data.materials[0].quantity).toBe(5);
    expect(data.cashMovements).toHaveLength(0);
    expect(() => parseCommand({ commandId: 'bad-demand', type: 'saveMaterial', material: { ...data.materials[0], manualDemand: -1 } })).toThrow();
  });
  it('mantém Pomada e Mousse na lista mesmo sem falta', () => {
    const data = empty();
    for (const material of data.materials.filter(item => item.alwaysOnShoppingList)) material.quantity = 10;
    const list = getShoppingList(data, '2026-11-07', '2026-11-14');
    expect(list.find(item => item.material.name === 'Pomada')).toMatchObject({ demand: 0, shortage: 0 });
    expect(list.find(item => item.material.name === 'Mousse')).toMatchObject({ demand: 0, shortage: 0 });
  });
  it('normaliza demo antiga sem reset, reutiliza nome existente e preserva seus valores', () => {
    const legacy = empty();
    legacy.materials = legacy.materials.filter(item => !item.alwaysOnShoppingList);
    legacy.materials.push({ id: 'my-pomada', name: 'pOMADA', unit: 'pote', quantity: 7.5, minimum: 2, manualDemand: 3, active: true });
    const before = structuredClone(legacy);
    const data = parseAppData(legacy);
    expect(data.materials.filter(item => item.name.toLowerCase() === 'pomada')).toHaveLength(1);
    expect(data.materials.find(item => item.id === 'my-pomada')).toMatchObject({ quantity: 7.5, minimum: 2, manualDemand: 3, alwaysOnShoppingList: true });
    expect(data.materials.find(item => item.id === 'mat-mousse')).toMatchObject({ name: 'Mousse', quantity: 0, minimum: 1, unit: 'frasco', alwaysOnShoppingList: true });
    expect(data.clients).toEqual(before.clients);
    expect(data.cashMovements).toEqual(before.cashMovements);
    expect(legacy).toEqual(before);
    expect(parseAppData(data)).toEqual(data);
  });
  it('calcula estoque 5, demanda 8, mínimo 0 => falta 3, sem dupla contagem', () => {
    const data = empty();
    data.materials[0].minimum = 0;
    let next = applyCommand(data, { ...appointment(), type: 'saveAppointment', appointment: { ...(appointment() as Extract<Command, { type: 'saveAppointment' }>).appointment, materials: [{ materialId: 'mat-fibra', quantity: 8 }] } }, now);
    const item = getShoppingList(next, '2026-11-07', '2026-11-14').find(item => item.material.id === 'mat-fibra');
    expect(item).toMatchObject({ demand: 8, shortage: 3 });
    next = applyCommand(next, { commandId: 'done', type: 'setAppointmentStatus', appointmentId: 'booking', status: 'completed' }, now);
    expect(getShoppingList(next, '2026-11-07', '2026-11-14').some(item => item.material.id === 'mat-fibra')).toBe(false);
    expect(next.materials[0].quantity).toBe(5);
  });
  it('compra atualiza estoque e caixa em operação atômica; uso não cria despesa', () => {
    let data = empty();
    data = applyCommand(data, { commandId: 'buy', type: 'recordStock', movement: { id: 'stock1', materialId: 'mat-fibra', kind: 'purchase', quantity: 3, costCents: 9000, date: '2026-11-07', notes: '' } }, now);
    expect(data.materials[0].quantity).toBe(8);
    expect(data.cashMovements[0]).toMatchObject({ direction: 'out', amountCents: 9000, stockMovementId: 'stock1' });
    data = applyCommand(data, { commandId: 'use', type: 'recordStock', movement: { id: 'stock2', materialId: 'mat-fibra', kind: 'consumption', quantity: 2, costCents: 0, date: '2026-11-07', notes: '' } }, now);
    expect(data.materials[0].quantity).toBe(6);
    expect(data.cashMovements).toHaveLength(1);
    expect(() => applyCommand(data, { commandId: 'too-much', type: 'recordStock', movement: { id: 'stock3', materialId: 'mat-fibra', kind: 'consumption', quantity: 7, costCents: 0, date: '2026-11-07', notes: '' } }, now)).toThrow(/suficiente/);
    expect(data.materials[0].quantity).toBe(6);
  });
});

describe('custos estimados dos serviços', () => {
  it('salva custo personalizado e preserva snapshot ao alterar serviço e remarcar, sem saída de caixa', () => {
    const booking = appointment() as Extract<Command, { type: 'saveAppointment' }>;
    let data = applyCommand(empty(), { ...booking, appointment: { ...booking.appointment, costCents: 7200 } }, now);
    data = applyCommand(data, { commandId: 'cost-update', type: 'saveService', service: { ...data.services[0], costCents: 9900 } }, now);
    data = applyCommand(data, { ...booking, commandId: 'cost-reschedule', appointment: { ...booking.appointment, startAt: '2026-11-08T09:00:00-03:00' } }, now);
    expect(data.services[0].costCents).toBe(9900);
    expect(data.appointments[0].costCents).toBe(7200);
    expect(parseAppData(data).appointments[0].costCents).toBe(7200);
    expect(data.cashMovements).toHaveLength(0);
    expect(getFinancialSummary(data, '2026-11-01', '2026-11-30').spent).toBe(0);
  });
  it('usa custo padrão em atendimento novo e aceita dados antigos sem custo', () => {
    const data = applyCommand(empty(), appointment(), now);
    expect(data.appointments[0].costCents).toBe(6000);
    expect(data.cashMovements).toHaveLength(0);
    const legacy = structuredClone(data);
    legacy.services.forEach(service => { delete service.costCents; });
    legacy.appointments.forEach(item => { delete item.costCents; });
    expect(() => parseAppData(legacy)).not.toThrow();
    const booking = appointment() as Extract<Command, { type: 'saveAppointment' }>;
    expect(applyCommand(legacy, { ...booking, commandId: 'legacy-reschedule' }, now).appointments[0].costCents).toBe(0);
    expect(() => parseCommand({ ...booking, appointment: { ...booking.appointment, costCents: -1 } })).toThrow();
    expect(() => parseCommand({ ...booking, appointment: { ...booking.appointment, costCents: 0.5 } })).toThrow();
  });
});

describe('validação e seed', () => {
  it('seed é válido, tem falta real e muda relativamente à data local', () => {
    const data = createSeedData(now);
    expect(parseAppData(data)).toEqual(data);
    expect(getShoppingList(data, '2026-11-07', '2026-11-14').length).toBeGreaterThan(0);
    expect(createSeedData(new Date('2026-11-08T01:00:00Z')).drafts[0].startAt).toContain('2026-11-10');
  });
  it('rejeita tipos desconhecidos, NaN, data impossível e campos extras', () => {
    expect(() => parseCommand({ type: 'reset', commandId: 'x' })).toThrow();
    expect(() => parseCommand({ ...payment('invalid', 100), extra: true })).toThrow();
    const cmd = payment('invalid', 100) as Extract<Command, { type: 'recordCash' }>;
    expect(() => parseCommand({ ...cmd, movement: { ...cmd.movement, date: '2026-02-30' } })).toThrow();
    expect(() => parseCommand({ ...cmd, movement: { ...cmd.movement, amountCents: NaN } })).toThrow();
    const booking = appointment() as Extract<Command, { type: 'saveAppointment' }>;
    expect(() => parseCommand({ ...booking, appointment: { ...booking.appointment, startAt: '2026-02-30T09:00:00-03:00' } })).toThrow();
  });
});
