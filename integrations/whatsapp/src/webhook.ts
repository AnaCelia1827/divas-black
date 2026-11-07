import express from 'express';
import type { ErrorRequestHandler } from 'express';
import { z } from 'zod';
import { equalSecret, verifySignature } from './security.ts';
import type { Config } from './config.ts';
import type { Store } from './store.ts';
import type { Message, StatusEvent } from './types.ts';

const id = z.string().min(1).max(256);
const timestamp = z.string().regex(/^\d{1,12}$/).refine(value => Number.isFinite(new Date(Number(value) * 1000).getTime()));
const envelopeSchema = z.object({
  object: z.literal('whatsapp_business_account'),
  entry: z.array(z.object({
    changes: z.array(z.object({
      field: z.string(),
      value: z.object({
        metadata: z.object({ phone_number_id: id }).optional(),
        contacts: z.array(z.object({ wa_id: id, profile: z.object({ name: z.string() }).optional() })).optional(),
        messages: z.array(z.object({
          id, from: id, timestamp, type: z.string().min(1),
          text: z.object({ body: z.string() }).optional(),
          context: z.object({ id: id.optional(), forwarded: z.boolean().optional(), frequently_forwarded: z.boolean().optional() }).optional(),
        }).passthrough()).optional(),
        statuses: z.array(z.object({ id, status: z.string(), timestamp })).optional(),
      }).passthrough(),
    })),
  })),
});

export function normalizeWebhook(input: unknown, now: number, allowedPhone?: string): { messages: Message[]; statuses: StatusEvent[] } {
  const envelope = envelopeSchema.parse(input);
  const messages: Message[] = [];
  const statuses: StatusEvent[] = [];
  for (const entry of envelope.entry) for (const change of entry.changes) {
    if (change.field !== 'messages') continue;
    const value = change.value;
    const phone = value.metadata?.phone_number_id;
    if (!phone || (allowedPhone && phone !== allowedPhone)) continue;
    for (const message of value.messages || []) {
      if (message.type === 'text' && !message.text) throw new Error('text_without_body');
      const media = message[message.type];
      const metadata: Record<string, unknown> = {};
      if (typeof media === 'object' && media !== null && message.type !== 'text') {
        // Somente metadados: não baixar mídia nem usar legendas como transcrição.
        for (const key of ['id', 'mime_type', 'sha256', 'filename', 'caption']) {
          const item = (media as Record<string, unknown>)[key];
          if (typeof item === 'string') metadata[key] = item;
        }
      }
      messages.push({
        id: message.id, phone_number_id: phone, conversation_id: `${phone}:${message.from}`,
        sender: { wa_id: message.from, profile_name: value.contacts?.find(contact => contact.wa_id === message.from)?.profile?.name || null },
        direction: 'inbound', timestamp: new Date(Number(message.timestamp) * 1000).toISOString(),
        received_at: new Date(now).toISOString(), type: message.type,
        text: message.type === 'text' ? message.text!.body : null,
        reply_to_message_id: message.context?.id || null,
        forwarded: !!(message.context?.forwarded || message.context?.frequently_forwarded), metadata,
      });
    }
    for (const status of value.statuses || []) statuses.push({
      phone_number_id: phone, message_id: status.id, status: status.status,
      timestamp: new Date(Number(status.timestamp) * 1000).toISOString(),
    });
  }
  return { messages, statuses };
}

export function createWebhookApp(store: Store, config: Pick<Config, 'appSecret' | 'verifyToken' | 'phoneNumberId' | 'debounceMs'>, now = Date.now) {
  const app = express();
  app.disable('x-powered-by');
  app.get('/health', (_req, res) => { res.json({ status: 'ok' }); });
  app.get('/webhooks/whatsapp', (req, res) => {
    if (req.query['hub.mode'] === 'subscribe' && typeof req.query['hub.verify_token'] === 'string'
        && equalSecret(req.query['hub.verify_token'], config.verifyToken) && typeof req.query['hub.challenge'] === 'string') {
      res.type('text/plain').status(200).send(req.query['hub.challenge']);
    } else res.sendStatus(403);
  });
  app.post('/webhooks/whatsapp', express.raw({ type: 'application/json', limit: '1mb' }), (req, res) => {
    if (!Buffer.isBuffer(req.body)) { res.sendStatus(415); return; }
    if (!verifySignature(req.body, req.get('x-hub-signature-256'), config.appSecret)) { res.sendStatus(401); return; }
    let normalized: ReturnType<typeof normalizeWebhook>;
    try { normalized = normalizeWebhook(JSON.parse(req.body.toString('utf8')), now(), config.phoneNumberId); }
    catch { res.status(400).json({ error: 'invalid_whatsapp_payload' }); return; }
    try {
      const result = store.ingest(normalized.messages, normalized.statuses, now(), config.debounceMs);
      res.status(200).json({ received: true, ...result });
    } catch {
      // Não reconhecer um evento que não foi persistido; a Meta pode tentar de novo.
      res.status(503).json({ error: 'storage_unavailable' });
    }
  });
  const errors: ErrorRequestHandler = (error, _req, res, _next) => {
    res.status(error?.type === 'entity.too.large' ? 413 : 500).json({ error: 'request_rejected' });
  };
  app.use(errors);
  return app;
}
