import type { AppData, Appointment, Service } from './types';
import { localDate } from './domain';
import { ensureFixedMaterials } from './fixed-materials';

export function createSeedData(now = new Date()): AppData {
  const today = localDate(now);
  const day = (offset: number) => {
    const value = new Date(`${today}T12:00:00Z`);
    value.setUTCDate(value.getUTCDate() + offset);
    return value.toISOString().slice(0, 10);
  };
  const services: Service[] = [
    { id: 'svc-box', name: 'Box Braids', priceCents: 32000, costCents: 6000, durationMinutes: 180, color: '#F4B6DA', active: true, materials: [{ materialId: 'mat-fibra', quantity: 3 }, { materialId: 'mat-gel', quantity: 0.15 }] },
    { id: 'svc-nago', name: 'Nagô', priceCents: 15000, costCents: 3500, durationMinutes: 90, color: '#E4D5F9', active: true, materials: [{ materialId: 'mat-gel', quantity: 0.1 }] },
    { id: 'svc-entrelace', name: 'Entrelace', priceCents: 28000, costCents: 8000, durationMinutes: 150, color: '#F4DE9C', active: true, materials: [{ materialId: 'mat-cabelo', quantity: 2 }] },
    { id: 'svc-trancas', name: 'Tranças em geral', priceCents: 20000, costCents: 4500, durationMinutes: 120, color: '#C4E3D5', active: true, materials: [{ materialId: 'mat-fibra', quantity: 2 }] },
    { id: 'svc-cuidado', name: 'Cuidado capilar', priceCents: 9000, costCents: 2500, durationMinutes: 60, color: '#C6DCF7', active: true, materials: [{ materialId: 'mat-creme', quantity: 0.2 }] },
  ];
  const names = ['Camila Santos', 'Jéssica Oliveira', 'Beatriz Souza', 'Larissa Costa', 'Ana Clara', 'Juliana Alves', 'Mariana Lima', 'Vitória Ribeiro', 'Fernanda Silva', 'Luana Martins', 'Gabriela Rocha', 'Patrícia Gomes'];
  const data: AppData = {
    schemaVersion: 1,
    clients: names.map((name, index) => ({ id: `client-${index + 1}`, name, phone: `1190000${String(index + 1).padStart(4, '0')}`, notes: index === 0 ? 'Prefere tranças médias, com pontas soltas.' : '', active: true, createdAt: `${day(-90)}T12:00:00.000Z` })),
    services,
    appointments: [], cashMovements: [], stockMovements: [], appliedCommandIds: [],
    materials: ensureFixedMaterials([
      { id: 'mat-fibra', name: 'Fibra jumbo · preto', unit: 'pacote', quantity: 5, minimum: 2, active: true },
      { id: 'mat-cabelo', name: 'Cabelo para entrelace', unit: 'pacote', quantity: 1, minimum: 1, active: true },
      { id: 'mat-gel', name: 'Gel para tranças', unit: 'pote', quantity: 2, minimum: 1, active: true },
      { id: 'mat-creme', name: 'Máscara de tratamento', unit: 'pote', quantity: 3, minimum: 1, active: true },
    ]),
    drafts: [{ id: 'draft-1', clientName: 'Aline Nascimento', clientPhone: '11900009999', serviceId: 'svc-box', startAt: `${day(3)}T09:00:00-03:00`, priceCents: 32000, notes: 'Box braids médias, cor preta.', message: 'Oi, Diva! Quero fazer box braids médias, pretas. Pode ser de manhã? O valor de R$ 320 fica bom. Me confirma o horário?' }],
  };
  let index = 0;
  const addAppointment = (offset: number, hour: string, serviceIndex: number, paidCents: number, completed = false) => {
    const service = services[serviceIndex];
    const appointment: Appointment = { id: `appt-${++index}`, clientId: data.clients[(index - 1) % names.length].id, serviceId: service.id, serviceName: service.name, serviceColor: service.color, startAt: `${day(offset)}T${hour}:00-03:00`, durationMinutes: service.durationMinutes, priceCents: service.priceCents, costCents: service.costCents ?? 0, status: completed ? 'completed' : 'confirmed', notes: '', materials: structuredClone(service.materials) };
    data.appointments.push(appointment);
    if (paidCents > 0) data.cashMovements.push({ id: `pay-${index}`, direction: 'in', amountCents: paidCents, date: day(Math.min(0, offset)), category: 'Serviços', description: `${service.name} · ${names[(index - 1) % names.length]}`, appointmentId: appointment.id, origin: 'payment', createdAt: `${day(Math.min(0, offset))}T12:00:00.000Z` });
  };
  for (let offset = -150; offset < 0; offset += 7) {
    const serviceIndex = Math.abs(offset) % services.length;
    addAppointment(offset, '09:00', serviceIndex, services[serviceIndex].priceCents, true);
  }
  addAppointment(0, '09:00', 1, 15000, true);
  addAppointment(0, '11:00', 4, 0);
  addAppointment(0, '13:00', 0, 8000);
  addAppointment(0, '16:30', 3, 5000);
  addAppointment(1, '09:00', 0, 10000);
  addAppointment(1, '14:00', 2, 0);
  addAppointment(2, '10:00', 1, 0);
  addAppointment(4, '09:00', 0, 0);
  addAppointment(5, '13:00', 3, 0);
  for (let offset = -145; offset <= 0; offset += 14) data.cashMovements.push({ id: `expense-${offset}`, direction: 'out', amountCents: offset % 3 === 0 ? 18000 : 8500, date: day(offset), category: offset % 3 === 0 ? 'Espaço' : 'Contas', description: offset % 3 === 0 ? 'Uso do espaço' : 'Água e energia', origin: 'manual', createdAt: `${day(offset)}T12:00:00.000Z` });
  return data;
}
