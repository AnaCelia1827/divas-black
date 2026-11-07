import { z } from 'zod';

const nullableText = z.string().nullable();
export const appointmentSchema = z.object({
  cliente: z.object({ nome: nullableText, telefone: nullableText }).strict(),
  data_informada: nullableText,
  data_atendimento: nullableText,
  hora_atendimento: nullableText,
  fuso_horario: z.literal('America/Sao_Paulo'),
  localizacao: z.object({
    tipo: z.enum(['salao', 'domicilio', 'outro', 'nao_informado']),
    descricao: nullableText,
    endereco: nullableText,
  }).strict(),
  servico: nullableText,
  requer_revisao: z.literal(true),
  pendencias: z.array(z.string()),
}).strict();

export const evidenceFields = [
  'cliente.nome', 'cliente.telefone', 'data_informada', 'data_atendimento',
  'hora_atendimento', 'localizacao', 'servico',
] as const;
export const extractionSchema = z.object({
  atendimento: appointmentSchema.nullable(),
  evidencias: z.array(z.object({
    campo: z.enum(evidenceFields),
    message_ids: z.array(z.string()),
  }).strict()),
}).strict();

export type Appointment = z.infer<typeof appointmentSchema>;
export type Extraction = z.infer<typeof extractionSchema>;

export interface Message {
  id: string;
  phone_number_id: string;
  conversation_id: string;
  sender: { wa_id: string; profile_name: string | null };
  direction: 'inbound';
  timestamp: string;
  received_at: string;
  type: string;
  text: string | null;
  reply_to_message_id: string | null;
  forwarded: boolean;
  metadata: Record<string, unknown>;
}

export interface StatusEvent {
  phone_number_id: string;
  message_id: string;
  status: string;
  timestamp: string;
}

export interface ConversationSnapshot {
  conversation_id: string;
  source_revision: number;
  messages: Message[];
  total_messages: number;
  new_messages?: Message[];
}

export interface Context {
  messages: Message[];
  truncated: boolean;
}

export interface IntegrationEvent {
  schema_version: 1;
  event_id: string;
  conversation_id: string;
  revision: number;
  phone_number_id: string;
  contact: Message['sender'];
  messages: Message[];
  atendimento: Appointment | null;
  evidencias: Extraction['evidencias'];
  extraction_status: 'completed' | 'failed';
  extraction_error: string | null;
  context_truncated: boolean;
  context_message_ids: string[];
  requires_review: true;
  generated_at: string;
}

export interface Delivery {
  event_id: string;
  payload: string;
  attempts: number;
}

export type Extractor = (context: Context) => Promise<Extraction>;

export const messageSchema = z.object({
  id: z.string().min(1), phone_number_id: z.string().min(1), conversation_id: z.string().min(1),
  sender: z.object({ wa_id: z.string().min(1), profile_name: nullableText }).strict(),
  direction: z.literal('inbound'), timestamp: z.iso.datetime(), received_at: z.iso.datetime(),
  type: z.string().min(1), text: nullableText, reply_to_message_id: nullableText,
  forwarded: z.boolean(), metadata: z.record(z.string(), z.unknown()),
}).strict();

export const integrationEventSchema = z.object({
  schema_version: z.literal(1), event_id: z.uuid(), conversation_id: z.string().min(1),
  revision: z.number().int().positive(), phone_number_id: z.string().min(1),
  contact: z.object({ wa_id: z.string().min(1), profile_name: nullableText }).strict(),
  messages: z.array(messageSchema).min(1), atendimento: appointmentSchema.nullable(),
  evidencias: extractionSchema.shape.evidencias,
  extraction_status: z.enum(['completed', 'failed']), extraction_error: nullableText,
  context_truncated: z.boolean(), context_message_ids: z.array(z.string()),
  requires_review: z.literal(true), generated_at: z.iso.datetime(),
}).strict();
