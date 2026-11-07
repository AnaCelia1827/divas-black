import { z } from 'zod';
import type { AppData, Command } from './types';
import { ensureFixedMaterials } from './fixed-materials';

const id = z.string().trim().min(1).max(160);
const text = z.string().max(2000);
const name = z.string().trim().min(1, 'Informe um nome.').max(120);
const cents = z.number().int().min(0).max(100000000);
const quantity = z.number().finite().min(0).max(1000000);
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe uma data válida.').refine(value => {
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, 'Informe uma data válida.');
const timestamp = z.string().max(40).refine(value => /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) && dateSchema.safeParse(value.slice(0, 10)).success && !Number.isNaN(Date.parse(value)), 'Informe data e horário válidos.');
const duration = z.number().int().min(5).max(1440);
const color = z.string().regex(/^#[\da-fA-F]{6}$/, 'Escolha uma cor válida.');
const status = z.enum(['confirmed', 'completed', 'cancelled', 'noshow']);
const clientInput = z.object({ id, name, phone: z.string().max(30), notes: text, active: z.boolean() }).strict();
const client = clientInput.extend({ createdAt: timestamp });
const recipe = z.array(z.object({ materialId: id, quantity: quantity.positive() }).strict()).max(100).refine(items => new Set(items.map(item => item.materialId)).size === items.length, 'Cada material deve aparecer uma vez.');
const service = z.object({ id, name, priceCents: cents, costCents: cents.optional(), durationMinutes: duration, color, active: z.boolean(), materials: recipe.optional() }).strict();
const appointmentInput = z.object({ id, clientId: id, serviceId: id, startAt: timestamp, durationMinutes: duration, priceCents: cents, costCents: cents.optional(), notes: text, draftId: id.optional(), materials: recipe.optional() }).strict();
const appointment = appointmentInput.extend({ serviceName: name, serviceColor: color, status });
const cashInput = z.object({ id, direction: z.enum(['in', 'out']), amountCents: cents.positive('Informe um valor maior que zero.'), date: dateSchema, category: name, description: text, appointmentId: id.optional(), stockMovementId: id.optional() }).strict();
const cash = cashInput.extend({ origin: z.enum(['manual', 'payment', 'purchase', 'refund']), createdAt: timestamp });
const material = z.object({ id, name, unit: name, quantity, minimum: quantity, active: z.boolean(), unitPriceCents: cents.optional(), manualDemand: quantity.optional(), alwaysOnShoppingList: z.boolean().optional() }).strict();
const stock = z.object({ id: id.max(140), materialId: id, kind: z.enum(['purchase', 'consumption', 'adjustment']), quantity: z.number().finite().min(-1000000).max(1000000), date: dateSchema, notes: text, costCents: cents }).strict();
const commandId = id;
const commandSchema = z.discriminatedUnion('type', [
  z.object({ commandId, type: z.literal('saveClient'), client: clientInput }).strict(),
  z.object({ commandId, type: z.literal('saveService'), service }).strict(),
  z.object({ commandId, type: z.literal('saveAppointment'), appointment: appointmentInput }).strict(),
  z.object({ commandId, type: z.literal('setAppointmentStatus'), appointmentId: id, status }).strict(),
  z.object({ commandId, type: z.literal('recordCash'), movement: cashInput }).strict(),
  z.object({ commandId, type: z.literal('refund'), appointmentId: id, movementId: id, amountCents: cents.positive(), date: dateSchema, description: text }).strict(),
  z.object({ commandId, type: z.literal('saveMaterial'), material }).strict(),
  z.object({ commandId, type: z.literal('recordStock'), movement: stock }).strict(),
]);
const appDataSchema = z.object({ schemaVersion: z.literal(1), clients: z.array(client).max(20000), services: z.array(service).max(1000), appointments: z.array(appointment).max(100000), cashMovements: z.array(cash).max(200000), materials: z.array(material).max(10000), stockMovements: z.array(stock).max(100000), drafts: z.array(z.object({ id, clientName: name, clientPhone: z.string().max(30), serviceId: id, startAt: timestamp, priceCents: cents, notes: text, message: text, confirmedAppointmentId: id.optional() }).strict()).max(10000), appliedCommandIds: z.array(id).max(500000) }).strict();

export function parseCommand(input: unknown): Command {
  const result = commandSchema.safeParse(input);
  if (!result.success) throw new Error(result.error.issues[0]?.message || 'Dados inválidos.');
  return result.data as Command;
}

export function parseAppData(input: unknown): AppData {
  const result = appDataSchema.safeParse(input);
  if (!result.success) throw new Error('Os dados salvos têm formato inválido ou versão incompatível. Seus registros não foram apagados.');
  const data = result.data as AppData;
  for (const records of [data.clients, data.services, data.appointments, data.cashMovements, data.materials, data.stockMovements, data.drafts]) {
    if (new Set(records.map(record => record.id)).size !== records.length) throw new Error('Os dados salvos contêm registros duplicados.');
  }
  if (data.appointments.some(item => !data.clients.some(client => client.id === item.clientId) || !data.services.some(service => service.id === item.serviceId))) throw new Error('Os dados salvos contêm atendimentos sem cadastro vinculado.');
  if (data.cashMovements.some(item => (item.appointmentId && !data.appointments.some(appointment => appointment.id === item.appointmentId)) || (item.stockMovementId && !data.stockMovements.some(stock => stock.id === item.stockMovementId)))) throw new Error('Os dados salvos contêm movimentos sem registro vinculado.');
  if (data.stockMovements.some(item => !data.materials.some(material => material.id === item.materialId))) throw new Error('Os dados salvos contêm movimentos sem material vinculado.');
  if ([...data.services, ...data.appointments].some(item => item.materials?.some(requirement => !data.materials.some(material => material.id === requirement.materialId)))) throw new Error('Os dados salvos contêm receitas sem material vinculado.');
  return { ...data, materials: ensureFixedMaterials(data.materials) };
}
