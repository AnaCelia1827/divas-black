import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { Store, openDatabase } from '../src/store.ts';
import { Worker } from '../src/worker.ts';
import { createReceiverApp } from '../src/receiver-app.ts';
import { createWebhookApp } from '../src/webhook.ts';
import { appSecret, event, extraction, fixture, message, serve, signature, token } from './helpers.ts';
import type { Context, Extraction, IntegrationEvent } from '../src/types.ts';

const config = { softwareUrl: 'http://127.0.0.1:3002/integrations/whatsapp/events', softwareToken: token };
const emptyExtraction = async (): Promise<Extraction> => ({ atendimento: null, evidencias: [] });

test('conversas isoladas, agrupadas por cinco segundos e ordenadas pelo horário original', async t => {
  const store = new Store(':memory:'); t.after(() => store.close());
  const first = { ...message('older'), timestamp: '2026-11-07T12:00:00.000Z' };
  const second = { ...message('newer'), timestamp: '2026-11-07T13:00:00.000Z' };
  store.ingest([second, first, message('other', '5511111111111')], [], 0, 5000);
  let now = 4999;
  const seen: Context[] = [];
  const worker = new Worker(store, async context => { seen.push(context); return emptyExtraction(); }, config, { now: () => now });
  assert.equal(await worker.processConversation(), false);
  now = 5000;
  assert.equal(await worker.processConversation(), true);
  assert.equal(await worker.processConversation(), true);
  assert.equal(await worker.processConversation(), false);
  const main = seen.find(context => context.messages.length === 2)!;
  assert.deepEqual(main.messages.map(item => item.id), ['older', 'newer']);
  assert.equal(seen.length, 2);
});

test('mensagem recebida durante extração continua pendente e gera nova revisão', async t => {
  const store = new Store(':memory:'); t.after(() => store.close());
  store.ingest([message()], [], 0, 0);
  let release!: (value: Extraction) => void;
  let calls = 0;
  const worker = new Worker(store, async () => {
    if (calls++ === 0) return new Promise<Extraction>(resolve => { release = resolve; });
    return emptyExtraction();
  }, config, { now: () => 10000 });
  const processing = worker.processConversation();
  store.ingest([message('m2')], [], 1000, 0);
  release(await emptyExtraction());
  await processing;
  assert.equal(store.nextConversation(10000)?.source_revision, 2);
  await worker.processConversation();
  const revisions = store.db.prepare('SELECT revision, payload FROM outbox ORDER BY revision').all();
  assert.equal(revisions.length, 2);
  assert.equal(JSON.parse(String(revisions[1]!.payload)).revision, 2);
  assert.equal(store.nextConversation(10000), undefined);
});

test('limitar contexto a 100 mensagens não perde mensagens novas na entrega', async t => {
  const store = new Store(':memory:'); t.after(() => store.close());
  store.ingest(Array.from({ length: 105 }, (_, index) => message(`m${index}`)), [], 0, 0);
  let contextSize = 0;
  const worker = new Worker(store, async context => { contextSize = context.messages.length; return emptyExtraction(); }, config, { now: () => 0 });
  await worker.processConversation();
  const delivered = JSON.parse(store.nextDelivery(0)!.payload) as IntegrationEvent;
  assert.equal(delivered.messages.length, 105);
  assert.ok(contextSize <= 100);
  assert.equal(delivered.context_truncated, true);
});

test('falha da IA preserva mensagens originais e envia atendimento nulo', async t => {
  const store = new Store(':memory:'); t.after(() => store.close());
  const msg = message(); store.ingest([msg], [], 0, 0);
  let delivered: IntegrationEvent | undefined;
  const worker = new Worker(store, async () => { throw new Error('upstream unavailable'); }, config, {
    now: () => 1000, fetcher: async (_url, request) => { delivered = JSON.parse(String(request?.body)); return new Response(null, { status: 204 }); },
  });
  await worker.tick();
  assert.equal(delivered?.extraction_status, 'failed'); assert.equal(delivered?.atendimento, null);
  assert.equal(delivered?.messages[0]?.text, msg.text);
  assert.equal(store.db.prepare('SELECT state FROM outbox').get()!.state, 'delivered');
});

test('retentativas em 5/30/120 segundos preservam o event_id; comando recoloca falha na fila', async t => {
  const store = new Store(':memory:'); t.after(() => store.close());
  store.ingest([message()], [], 0, 0);
  let now = 0;
  const ids: string[] = [];
  const worker = new Worker(store, emptyExtraction, config, { now: () => now, fetcher: async (_url, request) => {
    ids.push(JSON.parse(String(request?.body)).event_id); return new Response(null, { status: 503 });
  } });
  await worker.processConversation();
  await worker.deliver();
  assert.equal(store.db.prepare('SELECT next_attempt_at FROM outbox').get()!.next_attempt_at, 5000);
  now = 4999; assert.equal(await worker.deliver(), false);
  now = 5000; await worker.deliver();
  assert.equal(store.db.prepare('SELECT next_attempt_at FROM outbox').get()!.next_attempt_at, 35000);
  now = 35000; await worker.deliver();
  assert.equal(store.db.prepare('SELECT next_attempt_at FROM outbox').get()!.next_attempt_at, 155000);
  now = 155000; await worker.deliver();
  assert.equal(store.db.prepare('SELECT state FROM outbox').get()!.state, 'failed');
  assert.equal(new Set(ids).size, 1); assert.equal(ids.length, 4);
  assert.equal(store.replayFailed(now, ids[0]), 1);
  worker.fetcher = async () => new Response(null, { status: 204 });
  await worker.deliver();
  assert.equal(store.db.prepare('SELECT state FROM outbox').get()!.state, 'delivered');
});

test('429 e timeout são transitórios; 400 é falha sem repetição automática', async t => {
  for (const status of [429, 400, 'timeout'] as const) {
    const store = new Store(':memory:'); t.after(() => store.close());
    store.ingest([message()], [], 0, 0);
    const worker = new Worker(store, emptyExtraction, config, { now: () => 0, fetcher: async () => {
      if (status === 'timeout') throw new DOMException('timeout', 'TimeoutError');
      return new Response(null, { status });
    } });
    await worker.tick();
    assert.equal(store.db.prepare('SELECT state FROM outbox').get()!.state, status === 400 ? 'failed' : 'pending');
  }
});

test('SQLite mantém mensagens e entrega pendente após reinício', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'divas-black-test-'));
  const path = join(directory, 'test.sqlite');
  let store = new Store(path);
  try {
    store.ingest([message()], [], 0, 0);
    store.close(); store = new Store(path);
    assert.equal(store.nextConversation(0)?.messages.length, 1);
    const worker = new Worker(store, emptyExtraction, config, { now: () => 0 });
    await worker.processConversation();
    const before = store.nextDelivery(0)!;
    store.close(); store = new Store(path);
    assert.equal(store.nextDelivery(0)?.event_id, before.event_id);
    assert.equal(store.nextDelivery(0)?.payload, before.payload);
    assert.equal(store.nextConversation(0), undefined);
  } finally {
    store.close();
    assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + '\\') || resolve(directory).startsWith(resolve(tmpdir()) + '/'));
    rmSync(directory, { recursive: true, force: true });
  }
});

test('receptor exige Bearer, rejeita contrato inválido e não reaplica duplicatas/revisões antigas', async t => {
  const db = openDatabase(':memory:'); t.after(() => db.close());
  const host = await serve(createReceiverApp(db, token)); t.after(host.close);
  const url = `${host.url}/integrations/whatsapp/events`;
  const send = (body: unknown, auth = token) => fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth}` }, body: JSON.stringify(body),
  });
  const current = event(2);
  assert.equal((await send(current, 'bad')).status, 401);
  assert.equal((await send({})).status, 400);
  assert.equal((await (await send(current)).json()).applied, true);
  assert.equal((await (await send(current)).json()).duplicate, true);
  assert.equal((await (await send(event(1))).json()).applied, false);
  assert.equal(db.prepare('SELECT revision FROM latest_events').get()!.revision, 2);
  assert.equal(db.prepare('SELECT count(*) AS n FROM received_events').get()!.n, 2);
});

test('fluxo HTTP completo: webhook assinado → SQLite → extração → receptor', async t => {
  const store = new Store(':memory:'); t.after(() => store.close());
  const db = openDatabase(':memory:'); t.after(() => db.close());
  const receiver = await serve(createReceiverApp(db, token)); t.after(receiver.close);
  const webhook = await serve(createWebhookApp(store, { appSecret, verifyToken: 'verify', phoneNumberId: undefined, debounceMs: 0 }));
  t.after(webhook.close);
  const body = JSON.stringify(fixture());
  assert.equal((await fetch(`${webhook.url}/webhooks/whatsapp`, { method: 'POST', body,
    headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': signature(body) } })).status, 200);
  const worker = new Worker(store, async context => extraction(context.messages[0]!.id), {
    softwareUrl: `${receiver.url}/integrations/whatsapp/events`, softwareToken: token,
  });
  await worker.tick();
  const response = await fetch(`${receiver.url}/integrations/whatsapp/events`, { headers: { Authorization: `Bearer ${token}` } });
  const received = await response.json();
  assert.equal(received.events.length, 1);
  assert.equal(received.events[0].atendimento.cliente.nome, 'Maria');
  assert.equal(received.events[0].atendimento.data_atendimento, null);
  assert.equal(received.events[0].messages[0].forwarded, true);
  assert.equal(store.db.prepare('SELECT state FROM outbox').get()!.state, 'delivered');
});
