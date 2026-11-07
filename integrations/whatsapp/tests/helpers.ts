import { readFileSync } from 'node:fs';
import { createHmac, randomUUID } from 'node:crypto';
import type { Express } from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { normalizeWebhook } from '../src/webhook.ts';
import type { Extraction, IntegrationEvent, Message } from '../src/types.ts';

export const appSecret = 'test-app-secret';
export const token = 'test-software-token';
export function fixture() { return JSON.parse(readFileSync(new URL('../examples/whatsapp-message.json', import.meta.url), 'utf8')); }
export function message(id = 'm1', sender = '5500000000000'): Message {
  const value = fixture();
  value.entry[0].changes[0].value.messages[0].id = id;
  value.entry[0].changes[0].value.messages[0].from = sender;
  return normalizeWebhook(value, 1000).messages[0]!;
}
export function extraction(messageId = 'm1'): Extraction {
  return {
    atendimento: {
      cliente: { nome: 'Maria', telefone: null }, data_informada: '07/11', data_atendimento: null,
      hora_atendimento: '16:00', fuso_horario: 'America/Sao_Paulo',
      localizacao: { tipo: 'salao', descricao: 'No salão', endereco: null },
      servico: 'Tranças boxeadoras', requer_revisao: true, pendencias: [],
    },
    evidencias: ['cliente.nome', 'data_informada', 'hora_atendimento', 'localizacao', 'servico'].map(campo => ({
      campo: campo as Extraction['evidencias'][number]['campo'], message_ids: [messageId],
    })),
  };
}
export function event(revision = 1): IntegrationEvent {
  const msg = message();
  return {
    schema_version: 1, event_id: randomUUID(), conversation_id: msg.conversation_id, revision,
    phone_number_id: msg.phone_number_id, contact: msg.sender, messages: [msg], ...extraction(),
    extraction_status: 'completed', extraction_error: null, context_truncated: false,
    context_message_ids: [msg.id], requires_review: true, generated_at: new Date(1000).toISOString(),
  };
}
export function signature(body: string, secret = appSecret) {
  return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
}
export async function serve(app: Express): Promise<{ server: Server; url: string; close: () => Promise<void> }> {
  const server = await new Promise<Server>((resolve, reject) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    instance.once('error', reject);
  });
  const address = server.address() as AddressInfo;
  return { server, url: `http://127.0.0.1:${address.port}`, close: () => new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
    server.closeAllConnections();
  }) };
}
