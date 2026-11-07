import { z } from 'zod';

export const MESSAGE_EXAMPLE = 'Olá Maria, o atendimento ficou para dia 07/11/2026 para o salão mesmo, para fazer uma trança boxeadora no valor de R$200,00, a entrada vai ser R$80,00 e no final R$120,00';
export const MAX_MESSAGE_LENGTH = 4000;
const nullableText = z.string().trim().min(1).max(160).nullable();
const nullableMoney = z.number().int().min(0).max(100000000).nullable();
export const textExtractionSchema = z.object({
 clientName: nullableText, dateText: nullableText,
 date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
 }).nullable(),
 time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/).nullable(),
 location: nullableText, serviceName: nullableText,
 totalCents: nullableMoney, depositCents: nullableMoney, finalCents: nullableMoney,
 warnings: z.array(z.string().max(240)).max(20),
}).strict();
export type TextExtraction = z.infer<typeof textExtractionSchema>;

export function paymentWarning(total: number | null, deposit: number | null, final: number | null) {
 if (total !== null && deposit !== null && final !== null && deposit + final !== total) return 'A entrada e o valor final não somam o total. Confira os valores.';
 if (total !== null && (deposit !== null && deposit > total || final !== null && final > total)) return 'Uma das parcelas é maior que o total. Confira os valores.';
 return null;
}

export function textDraftNotes(message: string, fields: TextExtraction) {
 const money = (value: number | null) => value === null ? 'não informado' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value / 100);
 return `Local: ${fields.location || 'não informado'}. Serviço do atendimento: ${fields.serviceName || 'não informado'}.\nEntrada combinada: ${money(fields.depositCents)}. Valor final combinado: ${money(fields.finalCents)}. Pagamentos ainda não registrados.\nMensagem original (íntegra no rascunho): ${message}`.slice(0, 2000);
}
