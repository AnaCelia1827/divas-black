import express from 'express';
import type { ErrorRequestHandler } from 'express';
import { integrationEventSchema } from './types.ts';
import { equalSecret } from './security.ts';
import type { DatabaseSync } from 'node:sqlite';

export function createReceiverApp(db: DatabaseSync, token: string) {
  if (!token) throw new Error('Configure SOFTWARE_API_TOKEN para o receptor.');
  db.exec(`CREATE TABLE IF NOT EXISTS received_events (
    event_id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, revision INTEGER NOT NULL,
    payload TEXT NOT NULL, received_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS latest_events (
    conversation_id TEXT PRIMARY KEY, revision INTEGER NOT NULL, event_id TEXT NOT NULL, payload TEXT NOT NULL
  );`);
  const app = express();
  app.disable('x-powered-by');
  app.get('/health', (_req, res) => { res.json({ status: 'ok' }); });
  app.post('/integrations/whatsapp/events', (req, res, next) => {
    if (!equalSecret(req.get('authorization') || '', `Bearer ${token}`)) { res.sendStatus(401); return; }
    next();
  }, express.json({ limit: '110mb' }), (req, res) => {
    const parsed = integrationEventSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'invalid_event' }); return; }
    const event = parsed.data;
    if (event.messages.some(message => message.conversation_id !== event.conversation_id || message.phone_number_id !== event.phone_number_id)
        || event.conversation_id !== `${event.phone_number_id}:${event.contact.wa_id}`) {
      res.status(400).json({ error: 'inconsistent_conversation' }); return;
    }
    try {
      db.exec('BEGIN IMMEDIATE');
      const duplicate = db.prepare('SELECT event_id FROM received_events WHERE event_id = ?').get(event.event_id);
      if (duplicate) { db.exec('COMMIT'); res.json({ accepted: true, duplicate: true, applied: false }); return; }
      const payload = JSON.stringify(event);
      db.prepare('INSERT INTO received_events VALUES (?, ?, ?, ?, ?)')
        .run(event.event_id, event.conversation_id, event.revision, payload, new Date().toISOString());
      const result = db.prepare(`INSERT INTO latest_events VALUES (?, ?, ?, ?)
        ON CONFLICT(conversation_id) DO UPDATE SET revision = excluded.revision, event_id = excluded.event_id, payload = excluded.payload
        WHERE excluded.revision > latest_events.revision`)
        .run(event.conversation_id, event.revision, event.event_id, payload);
      db.exec('COMMIT');
      res.json({ accepted: true, duplicate: false, applied: Number(result.changes) > 0 });
    } catch {
      if (db.isTransaction) db.exec('ROLLBACK');
      res.status(503).json({ error: 'receiver_storage_unavailable' });
    }
  });
  app.get('/integrations/whatsapp/events', (req, res) => {
    if (!equalSecret(req.get('authorization') || '', `Bearer ${token}`)) { res.sendStatus(401); return; }
    const events = db.prepare('SELECT payload FROM latest_events ORDER BY conversation_id').all()
      .map(row => JSON.parse(String(row.payload)) as unknown);
    res.json({ events });
  });
  const errors: ErrorRequestHandler = (error, _req, res, _next) => {
    res.status(error?.type === 'entity.too.large' ? 413 : 400).json({ error: 'invalid_request_body' });
  };
  app.use(errors);
  return app;
}
