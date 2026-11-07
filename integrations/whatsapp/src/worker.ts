import { randomUUID } from 'node:crypto';
import { buildContext, ExtractionError } from './extraction.ts';
import { integrationEventSchema } from './types.ts';
import type { Store } from './store.ts';
import type { Config } from './config.ts';
import type { Extractor, Extraction, IntegrationEvent } from './types.ts';

export class Worker {
  store: Store;
  extract: Extractor;
  config: Pick<Config, 'softwareUrl' | 'softwareToken'>;
  fetcher: typeof fetch;
  now: () => number;
  retryDelays: number[];
  timer?: ReturnType<typeof setInterval>;
  running?: Promise<void>;

  constructor(store: Store, extract: Extractor, config: Pick<Config, 'softwareUrl' | 'softwareToken'>,
    options: { fetcher?: typeof fetch; now?: () => number; retryDelays?: number[] } = {}) {
    this.store = store; this.extract = extract; this.config = config;
    this.fetcher = options.fetcher || fetch; this.now = options.now || Date.now;
    this.retryDelays = options.retryDelays || [5000, 30000, 120000];
  }

  async processConversation(): Promise<boolean> {
    const snapshot = this.store.nextConversation(this.now());
    if (!snapshot) return false;
    const context = buildContext(snapshot);
    let extraction: Extraction = { atendimento: null, evidencias: [] };
    let error: string | null = null;
    try { extraction = await this.extract(context); }
    catch (failure) { error = failure instanceof ExtractionError ? failure.code : 'extraction_failed'; }
    if (context.truncated && extraction.atendimento) extraction.atendimento.pendencias.push('Contexto parcial: revisar mensagens anteriores');
    this.store.complete(snapshot, this.now(), revision => {
      const latest = snapshot.messages.at(-1)!;
      // O limite de IA não pode descartar mensagens ainda não entregues ao software.
      const originals = [...new Map([...(snapshot.new_messages || []), ...snapshot.messages].map(message => [message.id, message])).values()]
        .sort((left, right) => left.timestamp.localeCompare(right.timestamp));
      const event: IntegrationEvent = {
        schema_version: 1, event_id: randomUUID(), conversation_id: snapshot.conversation_id,
        revision, phone_number_id: latest.phone_number_id, contact: latest.sender,
        messages: originals, atendimento: extraction.atendimento, evidencias: extraction.evidencias,
        extraction_status: error ? 'failed' : 'completed', extraction_error: error,
        context_truncated: context.truncated, context_message_ids: context.messages.map(message => message.id),
        requires_review: true, generated_at: new Date(this.now()).toISOString(),
      };
      integrationEventSchema.parse(event);
      return event;
    });
    return true;
  }

  async deliver(): Promise<boolean> {
    const delivery = this.store.nextDelivery(this.now());
    if (!delivery) return false;
    try {
      const response = await this.fetcher(this.config.softwareUrl, {
        method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(10000),
        headers: { Authorization: `Bearer ${this.config.softwareToken}`, 'Content-Type': 'application/json', 'Idempotency-Key': delivery.event_id },
        body: delivery.payload,
      });
      // Não registrar corpos de resposta: podem conter dados pessoais ou credenciais.
      await response.body?.cancel();
      if (response.ok) this.store.deliverySucceeded(delivery.event_id, this.now());
      else this.store.deliveryFailed(delivery, this.now(), `receiver_http_${response.status}`,
        response.status === 429 || response.status >= 500, this.retryDelays);
    } catch {
      this.store.deliveryFailed(delivery, this.now(), 'receiver_network_or_timeout', true, this.retryDelays);
    }
    return true;
  }

  tick(): Promise<void> {
    if (this.running) return this.running;
    this.running = (async () => {
      await this.deliver();
      await this.processConversation();
      await this.deliver();
    })().finally(() => { this.running = undefined; });
    return this.running;
  }

  start() {
    if (this.timer) return;
    const run = () => { void this.tick().catch(() => console.error('worker_failed: operação permanece pendente no SQLite')); };
    this.timer = setInterval(run, 500);
    run();
  }

  async stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    await this.running;
  }
}
