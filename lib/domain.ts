import type { AppData, Appointment, Command, FinancialSummary, Material } from './types';
import { dateSchema, parseCommand } from './validation';
import { ensureFixedMaterials } from './fixed-materials';

export function getAppointmentPaid(data: AppData, id: string): number {
  return data.cashMovements.filter(item => item.appointmentId === id).reduce((total, item) => total + (item.direction === 'in' ? item.amountCents : -item.amountCents), 0);
}
export function getAppointmentBalance(data: AppData, id: string): number {
  const appointment = data.appointments.find(item => item.id === id);
  return appointment ? Math.max(0, appointment.priceCents - getAppointmentPaid(data, id)) : 0;
}
export function localDate(value: string | Date): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
}
export function getFinancialSummary(data: AppData, from: string, to: string): FinancialSummary {
  dateSchema.parse(from); dateSchema.parse(to);
  if (from > to) throw new Error('O início do período deve vir antes do fim.');
  const movements = data.cashMovements.filter(item => item.date >= from && item.date <= to);
  const received = movements.filter(item => item.direction === 'in').reduce((total, item) => total + item.amountCents, 0);
  const spent = movements.filter(item => item.direction === 'out').reduce((total, item) => total + item.amountCents, 0);
  const receivable = data.appointments.filter(item => item.status !== 'cancelled' && item.status !== 'noshow' && localDate(item.startAt) >= from && localDate(item.startAt) <= to).reduce((total, item) => total + getAppointmentBalance(data, item.id), 0);
  return { received, spent, balance: received - spent, receivable };
}
export function getShoppingList(data: AppData, from: string, to: string): { material: Material; demand: number; shortage: number }[] {
  dateSchema.parse(from); dateSchema.parse(to);
  if (from > to) throw new Error('O início do período deve vir antes do fim.');
  const demand = new Map<string, number>();
  for (const appointment of data.appointments) {
    if (appointment.status !== 'confirmed' || localDate(appointment.startAt) < from || localDate(appointment.startAt) > to) continue;
    for (const item of appointment.materials ?? []) demand.set(item.materialId, (demand.get(item.materialId) ?? 0) + item.quantity);
  }
  return data.materials.filter(item => item.active).map(material => {
    const totalDemand = (demand.get(material.id) ?? 0) + (material.manualDemand ?? 0);
    return { material, demand: totalDemand, shortage: Math.max(0, Math.round((totalDemand + material.minimum - material.quantity) * 1000) / 1000) };
  }).filter(item => item.shortage > 0 || item.material.alwaysOnShoppingList);
}
function checkConflict(data: AppData, appointment: Appointment) {
  if (appointment.status === 'cancelled' || appointment.status === 'noshow') return;
  const start = Date.parse(appointment.startAt);
  const end = start + appointment.durationMinutes * 60000;
  if (data.appointments.some(item => item.id !== appointment.id && item.status !== 'cancelled' && item.status !== 'noshow' && start < Date.parse(item.startAt) + item.durationMinutes * 60000 && end > Date.parse(item.startAt))) throw new Error('Esse horário já está ocupado. Escolha outro horário.');
}

export function applyCommand(input: AppData, rawCommand: Command, now = new Date()): AppData {
  const command = parseCommand(rawCommand);
  if (input.appliedCommandIds.includes(command.commandId)) return input;
  const data: AppData = structuredClone(input);
  const createdAt = now.toISOString();
  const appointmentById = (id: string) => {
    const item = data.appointments.find(appointment => appointment.id === id);
    if (!item) throw new Error('Atendimento não encontrado.');
    return item;
  };
  switch (command.type) {
    case 'saveClient': {
      const previous = data.clients.find(item => item.id === command.client.id);
      const next = { ...command.client, createdAt: previous?.createdAt ?? createdAt };
      data.clients = previous ? data.clients.map(item => item.id === next.id ? next : item) : [...data.clients, next];
      break;
    }
    case 'saveService': {
      if (command.service.materials?.some(requirement => !data.materials.some(material => material.id === requirement.materialId && material.active))) throw new Error('Escolha materiais ativos para o serviço.');
      const exists = data.services.some(item => item.id === command.service.id);
      data.services = exists ? data.services.map(item => item.id === command.service.id ? command.service : item) : [...data.services, command.service];
      break;
    }
    case 'saveAppointment': {
      const previous = data.appointments.find(item => item.id === command.appointment.id);
      const client = data.clients.find(item => item.id === command.appointment.clientId);
      const service = data.services.find(item => item.id === command.appointment.serviceId);
      if (!client || (!client.active && previous?.clientId !== client.id)) throw new Error('Escolha uma cliente ativa.');
      if (!service || (!service.active && previous?.serviceId !== service.id)) throw new Error('Escolha um serviço ativo.');
      if (command.appointment.priceCents < getAppointmentPaid(data, command.appointment.id)) throw new Error('O valor combinado não pode ser menor que o já recebido.');
      if (previous?.status === 'completed') throw new Error('Um atendimento concluído não pode ser remarcado.');
      if (command.appointment.draftId) {
        const draft = data.drafts.find(item => item.id === command.appointment.draftId);
        if (!draft) throw new Error('Sugestão da assistente não encontrada.');
        if (draft.confirmedAppointmentId && draft.confirmedAppointmentId !== command.appointment.id) throw new Error('Essa sugestão já foi confirmada.');
        draft.confirmedAppointmentId = command.appointment.id;
      }
      const materials = command.appointment.materials ?? (previous?.serviceId === service.id ? previous.materials : service.materials) ?? [];
      if (materials.some(requirement => !data.materials.some(material => material.id === requirement.materialId))) throw new Error('Material do atendimento não encontrado.');
      const costCents = command.appointment.costCents ?? (previous?.serviceId === service.id ? previous.costCents : service.costCents) ?? 0;
      const next: Appointment = { ...command.appointment, costCents, materials: structuredClone(materials), serviceName: previous?.serviceId === service.id ? previous.serviceName : service.name, serviceColor: previous?.serviceId === service.id ? previous.serviceColor : service.color, status: previous?.status ?? 'confirmed' };
      checkConflict(data, next);
      data.appointments = previous ? data.appointments.map(item => item.id === next.id ? next : item) : [...data.appointments, next];
      break;
    }
    case 'setAppointmentStatus': {
      const appointment = appointmentById(command.appointmentId);
      if (appointment.status === 'completed' && command.status !== 'completed') throw new Error('Atendimento concluído não pode mudar de situação.');
      checkConflict(data, { ...appointment, status: command.status });
      appointment.status = command.status;
      break;
    }
    case 'recordCash': {
      const movement = command.movement;
      if (data.cashMovements.some(item => item.id === movement.id)) throw new Error('Esse lançamento já foi registrado.');
      if (movement.stockMovementId) throw new Error('Registre uma compra pela tela de materiais.');
      if (movement.appointmentId) {
        const appointment = appointmentById(movement.appointmentId);
        if (movement.direction !== 'in') throw new Error('Para devolver um pagamento, use Reembolsar.');
        if (appointment.status === 'cancelled' || appointment.status === 'noshow') throw new Error('Esse atendimento não está disponível para receber pagamentos.');
        if (movement.amountCents > getAppointmentBalance(data, appointment.id)) throw new Error('O valor é maior que o saldo a receber.');
      }
      data.cashMovements.push({ ...movement, origin: movement.appointmentId ? 'payment' : 'manual', createdAt });
      break;
    }
    case 'refund': {
      appointmentById(command.appointmentId);
      if (data.cashMovements.some(item => item.id === command.movementId)) throw new Error('Esse reembolso já foi registrado.');
      if (command.amountCents > getAppointmentPaid(data, command.appointmentId)) throw new Error('O reembolso é maior que o valor recebido.');
      data.cashMovements.push({ id: command.movementId, appointmentId: command.appointmentId, direction: 'out', amountCents: command.amountCents, date: command.date, category: 'Reembolso', description: command.description, origin: 'refund', createdAt });
      break;
    }
    case 'saveMaterial': {
      const previous = data.materials.find(item => item.id === command.material.id);
      if (previous && previous.quantity !== command.material.quantity) throw new Error('Para mudar o saldo, registre uma compra, uso ou ajuste.');
      data.materials = previous ? data.materials.map(item => item.id === command.material.id ? command.material : item) : [...data.materials, command.material];
      break;
    }
    case 'recordStock': {
      const movement = command.movement;
      if (data.stockMovements.some(item => item.id === movement.id)) throw new Error('Esse movimento já foi registrado.');
      const material = data.materials.find(item => item.id === movement.materialId && item.active);
      if (!material) throw new Error('Escolha um material ativo.');
      if (movement.kind !== 'adjustment' && movement.quantity <= 0) throw new Error('Informe uma quantidade maior que zero.');
      if (movement.kind === 'adjustment' && movement.quantity === 0) throw new Error('Informe a quantidade do ajuste.');
      if (movement.kind !== 'purchase' && movement.costCents !== 0) throw new Error('Uso e ajuste não geram despesas. Registre custo somente em compras.');
      if (movement.kind === 'purchase' && movement.costCents <= 0) throw new Error('Informe o valor pago pela compra.');
      const delta = movement.kind === 'consumption' ? -movement.quantity : movement.quantity;
      if (material.quantity + delta < 0) throw new Error('Não há material suficiente para essa retirada.');
      material.quantity = Math.round((material.quantity + delta) * 1000) / 1000;
      data.stockMovements.push(movement);
      if (movement.kind === 'purchase') {
        const id = `purchase:${movement.id}`;
        if (data.cashMovements.some(item => item.id === id)) throw new Error('Essa compra já tem um lançamento no caixa.');
        data.cashMovements.push({ id, direction: 'out', amountCents: movement.costCents, date: movement.date, category: 'Materiais', description: `Compra · ${material.name}`, stockMovementId: movement.id, origin: 'purchase', createdAt });
      }
      break;
    }
  }
  data.materials = ensureFixedMaterials(data.materials);
  data.appliedCommandIds.push(command.commandId);
  return data;
}
