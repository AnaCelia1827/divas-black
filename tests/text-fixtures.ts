import { MESSAGE_EXAMPLE, type TextExtraction } from '../lib/text-draft';
import type { AssistantDraft, Command } from '../lib/types';
export const fields: TextExtraction = { clientName: 'Maria', dateText: '07/11/2026', date: '2026-11-07', time: null, location: 'salão', serviceName: 'trança boxeadora', totalCents: 20000, depositCents: 8000, finalCents: 12000, warnings: ['Informe o horário do atendimento.'] };
export const rawFields = (): Record<Exclude<keyof TextExtraction, 'warnings'>, { value: string | number | null; source: string | null }> => ({
 clientName: { value: 'Maria', source: 'Maria' }, dateText: { value: '07/11/2026', source: '07/11/2026' }, date: { value: '2026-11-07', source: '07/11/2026' }, time: { value: null, source: null },
 location: { value: 'salão', source: 'salão' }, serviceName: { value: 'trança boxeadora', source: 'trança boxeadora' }, totalCents: { value: 20000, source: 'R$200,00' }, depositCents: { value: 8000, source: 'R$80,00' }, finalCents: { value: 12000, source: 'R$120,00' },
});
export const draft = (): AssistantDraft & { extraction: TextExtraction } => ({ id: 'text-draft', clientName: 'Maria', clientPhone: '', serviceId: '', startAt: '', priceCents: 20000, notes: '', message: MESSAGE_EXAMPLE, extraction: fields });
export const confirmCommand = (): Extract<Command, { type: 'confirmTextDraft' }> => ({
 commandId: 'text-confirm', type: 'confirmTextDraft', draftId: 'text-draft',
 client: { id: 'text-client', name: 'Maria', phone: '', notes: '', active: true },
 service: { id: 'text-service', name: 'trança boxeadora', priceCents: 20000, durationMinutes: 60, color: '#F4B6DA', active: true },
 appointment: { id: 'text-appointment', clientId: 'text-client', serviceId: 'text-service', draftId: 'text-draft', startAt: '2026-11-07T20:00:00-03:00', durationMinutes: 60, priceCents: 20000, notes: '' },
 review: { ...fields, time: '20:00', warnings: [] },
});
