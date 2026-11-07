import test from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../src/store.ts';
import { createWebhookApp, normalizeWebhook } from '../src/webhook.ts';
import { appSecret, fixture, serve, signature } from './helpers.ts';

const config = { appSecret, verifyToken: 'test-verify-token', phoneNumberId: undefined, debounceMs: 5000 };

test('GET verifica token e devolve challenge; token inválido é rejeitado', async t => {
  const store = new Store(':memory:'); t.after(() => store.close());
  const host = await serve(createWebhookApp(store, config)); t.after(host.close);
  const good = await fetch(`${host.url}/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=test-verify-token&hub.challenge=123`);
  assert.equal(good.status, 200); assert.equal(await good.text(), '123');
  assert.equal((await fetch(`${host.url}/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=bad&hub.challenge=123`)).status, 403);
});

test('assinatura inválida ou corpo adulterado não persiste mensagens', async t => {
  const store = new Store(':memory:'); t.after(() => store.close());
  const host = await serve(createWebhookApp(store, config)); t.after(host.close);
  const body = JSON.stringify(fixture());
  const response = await fetch(`${host.url}/webhooks/whatsapp`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': signature(body + ' ') }, body,
  });
  assert.equal(response.status, 401);
  assert.equal(store.db.prepare('SELECT count(*) AS n FROM messages').get()!.n, 0);
});

test('evento assinado é persistido antes do 200 e duplicatas não alteram a fila', async t => {
  const store = new Store(':memory:'); t.after(() => store.close());
  let now = 0;
  const host = await serve(createWebhookApp(store, config, () => now)); t.after(host.close);
  const body = JSON.stringify(fixture());
  const send = () => fetch(`${host.url}/webhooks/whatsapp`, { method: 'POST', body,
    headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': signature(body) } });
  const first = await send(); assert.equal(first.status, 200);
  assert.equal((await first.json()).inserted_messages, 1);
  now = 4000;
  const duplicate = await send(); assert.equal((await duplicate.json()).inserted_messages, 0);
  assert.equal(store.nextConversation(4999), undefined);
  assert.equal(store.nextConversation(5000)?.messages[0]?.text, fixture().entry[0].changes[0].value.messages[0].text.body);
});

test('percorre todas as entries/changes; status não vira conversa e outra conta é isolada', () => {
  const input = fixture();
  const entry = structuredClone(input.entry[0]);
  entry.changes[0].value.messages[0].id = 'other-message';
  entry.changes[0].value.messages[0].from = '5511111111111';
  entry.changes.push({ field: 'messages', value: { metadata: { phone_number_id: '100000000000000' },
    statuses: [{ id: 'sent-message', status: 'read', timestamp: '1794052800' }] } });
  input.entry.push(entry);
  const normalized = normalizeWebhook(input, 1000);
  assert.equal(normalized.messages.length, 2);
  assert.equal(normalized.statuses.length, 1);
  assert.notEqual(normalized.messages[0]!.conversation_id, normalized.messages[1]!.conversation_id);
  assert.equal(normalizeWebhook(input, 1000, 'another-phone').messages.length, 0);
});

test('mídia guarda somente metadados e não é tratada como texto', () => {
  const input = fixture();
  const msg = input.entry[0].changes[0].value.messages[0];
  msg.type = 'audio'; delete msg.text; msg.audio = { id: 'media-1', mime_type: 'audio/ogg', voice: true };
  const message = normalizeWebhook(input, 1000).messages[0]!;
  assert.equal(message.text, null); assert.deepEqual(message.metadata, { id: 'media-1', mime_type: 'audio/ogg' });
});

test('falha de armazenamento não reconhece evento; payload inválido é 400', async t => {
  const store = new Store(':memory:'); t.after(() => store.close());
  const host = await serve(createWebhookApp(store, config)); t.after(host.close);
  store.ingest = () => { throw new Error('disk_full'); };
  const body = JSON.stringify(fixture());
  const send = (payload: string) => fetch(`${host.url}/webhooks/whatsapp`, { method: 'POST', body: payload,
    headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': signature(payload) } });
  assert.equal((await send(body)).status, 503);
  assert.equal((await send('{')).status, 400);
});
