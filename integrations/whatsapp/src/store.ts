import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { ConversationSnapshot, Delivery, IntegrationEvent, Message, StatusEvent } from './types.ts';

export function openDatabase(path: string): DatabaseSync {
  if (path !== ':memory:') mkdirSync(dirname(resolve(path)), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON;');
  return db;
}

export class Store {
  db: DatabaseSync;
  constructor(path: string) {
    this.db = openDatabase(path);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY, source_revision INTEGER NOT NULL DEFAULT 0,
        processed_revision INTEGER NOT NULL DEFAULT 0, delivery_revision INTEGER NOT NULL DEFAULT 0,
        ready_at INTEGER
      );
      CREATE TABLE IF NOT EXISTS messages (
        seq INTEGER PRIMARY KEY AUTOINCREMENT,
        phone_number_id TEXT NOT NULL, message_id TEXT NOT NULL,
        conversation_id TEXT NOT NULL REFERENCES conversations(id),
        timestamp TEXT NOT NULL, payload TEXT NOT NULL, source_revision INTEGER NOT NULL,
        UNIQUE(phone_number_id, message_id)
      );
      CREATE INDEX IF NOT EXISTS messages_conversation ON messages(conversation_id, timestamp, seq);
      CREATE TABLE IF NOT EXISTS status_events (
        phone_number_id TEXT NOT NULL, message_id TEXT NOT NULL, status TEXT NOT NULL,
        timestamp TEXT NOT NULL, UNIQUE(phone_number_id, message_id, status, timestamp)
      );
      CREATE TABLE IF NOT EXISTS outbox (
        event_id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, revision INTEGER NOT NULL,
        payload TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'pending',
        attempts INTEGER NOT NULL DEFAULT 0, next_attempt_at INTEGER NOT NULL,
        last_error TEXT, delivered_at TEXT,
        UNIQUE(conversation_id, revision)
      );
      CREATE INDEX IF NOT EXISTS outbox_pending ON outbox(state, next_attempt_at);
    `);
  }

  transaction<T>(run: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try { const result = run(); this.db.exec('COMMIT'); return result; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }

  ingest(messages: Message[], statuses: StatusEvent[], now: number, debounceMs: number) {
    return this.transaction(() => {
      let inserted = 0;
      let statusCount = 0;
      for (const message of messages) {
        this.db.prepare('INSERT OR IGNORE INTO conversations(id) VALUES (?)').run(message.conversation_id);
        const sourceRevision = Number(this.db.prepare('SELECT source_revision FROM conversations WHERE id = ?').get(message.conversation_id)!.source_revision) + 1;
        const result = this.db.prepare(`INSERT OR IGNORE INTO messages
          (phone_number_id, message_id, conversation_id, timestamp, payload, source_revision) VALUES (?, ?, ?, ?, ?, ?)`)
          .run(message.phone_number_id, message.id, message.conversation_id, message.timestamp, JSON.stringify(message), sourceRevision);
        if (Number(result.changes)) {
          inserted++;
          this.db.prepare('UPDATE conversations SET source_revision = source_revision + 1, ready_at = ? WHERE id = ?')
            .run(now + debounceMs, message.conversation_id);
        }
      }
      for (const status of statuses) {
        statusCount += Number(this.db.prepare('INSERT OR IGNORE INTO status_events VALUES (?, ?, ?, ?)')
          .run(status.phone_number_id, status.message_id, status.status, status.timestamp).changes);
      }
      return { inserted_messages: inserted, inserted_statuses: statusCount };
    });
  }

  nextConversation(now: number): ConversationSnapshot | undefined {
    const row = this.db.prepare(`SELECT id, source_revision, processed_revision FROM conversations
      WHERE source_revision > processed_revision AND ready_at <= ? ORDER BY ready_at, id LIMIT 1`).get(now);
    if (!row) return undefined;
    const id = String(row.id);
    const rows = this.db.prepare(`SELECT payload FROM (
      SELECT payload, timestamp, seq FROM messages WHERE conversation_id = ? ORDER BY timestamp DESC, seq DESC LIMIT 100
    ) ORDER BY timestamp, seq`).all(id);
    const count = this.db.prepare('SELECT COUNT(*) AS count FROM messages WHERE conversation_id = ?').get(id)!;
    const fresh = this.db.prepare('SELECT payload FROM messages WHERE conversation_id = ? AND source_revision > ? ORDER BY timestamp, seq')
      .all(id, Number(row.processed_revision));
    return {
      conversation_id: id, source_revision: Number(row.source_revision), total_messages: Number(count.count),
      messages: rows.map(item => JSON.parse(String(item.payload)) as Message),
      new_messages: fresh.map(item => JSON.parse(String(item.payload)) as Message),
    };
  }

  complete(snapshot: ConversationSnapshot, now: number, build: (revision: number) => IntegrationEvent): IntegrationEvent {
    return this.transaction(() => {
      const row = this.db.prepare('SELECT delivery_revision FROM conversations WHERE id = ?').get(snapshot.conversation_id)!;
      const revision = Number(row.delivery_revision) + 1;
      const event = build(revision);
      this.db.prepare(`INSERT INTO outbox(event_id, conversation_id, revision, payload, next_attempt_at) VALUES (?, ?, ?, ?, ?)`)
        .run(event.event_id, event.conversation_id, revision, JSON.stringify(event), now);
      // Mensagens recebidas enquanto a IA trabalhava continuam pendentes.
      this.db.prepare(`UPDATE conversations SET delivery_revision = ?, processed_revision = ?,
        ready_at = CASE WHEN source_revision > ? THEN ready_at ELSE NULL END WHERE id = ?`)
        .run(revision, snapshot.source_revision, snapshot.source_revision, snapshot.conversation_id);
      return event;
    });
  }

  nextDelivery(now: number): Delivery | undefined {
    const row = this.db.prepare(`SELECT event_id, payload, attempts FROM outbox
      WHERE state = 'pending' AND next_attempt_at <= ? ORDER BY next_attempt_at, rowid LIMIT 1`).get(now);
    return row ? { event_id: String(row.event_id), payload: String(row.payload), attempts: Number(row.attempts) } : undefined;
  }

  deliverySucceeded(id: string, now: number) {
    this.db.prepare(`UPDATE outbox SET state = 'delivered', attempts = attempts + 1, last_error = NULL, delivered_at = ? WHERE event_id = ?`)
      .run(new Date(now).toISOString(), id);
  }

  deliveryFailed(delivery: Delivery, now: number, error: string, retryable: boolean, delays: number[]) {
    const delay = delays[delivery.attempts];
    const retry = retryable && delay !== undefined;
    this.db.prepare(`UPDATE outbox SET state = ?, attempts = attempts + 1, next_attempt_at = ?, last_error = ? WHERE event_id = ?`)
      .run(retry ? 'pending' : 'failed', now + (delay ?? 0), error, delivery.event_id);
  }

  replayFailed(now: number, eventId?: string): number {
    return Number(eventId
      ? this.db.prepare(`UPDATE outbox SET state = 'pending', attempts = 0, next_attempt_at = ?, last_error = NULL WHERE state = 'failed' AND event_id = ?`).run(now, eventId).changes
      : this.db.prepare(`UPDATE outbox SET state = 'pending', attempts = 0, next_attempt_at = ?, last_error = NULL WHERE state = 'failed'`).run(now).changes);
  }

  close() { this.db.close(); }
}
