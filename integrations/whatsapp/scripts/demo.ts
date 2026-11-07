import { createHmac, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { setTimeout } from 'node:timers/promises';
import { loadConfig } from '../src/config.ts';
import { integrationEventSchema } from '../src/types.ts';

try {
  const config = loadConfig();
  const fixture = JSON.parse(readFileSync(new URL('../examples/whatsapp-message.json', import.meta.url), 'utf8'));
  const value = fixture.entry[0].changes[0].value;
  const messageId = `wamid.demo-${randomUUID()}`;
  value.messages[0].id = messageId;
  value.messages[0].timestamp = String(Math.floor(Date.now() / 1000));
  if (config.phoneNumberId) value.metadata.phone_number_id = config.phoneNumberId;
  const body = JSON.stringify(fixture);
  const signature = createHmac('sha256', config.appSecret).update(body).digest('hex');
  const response = await fetch(`http://127.0.0.1:${config.port}/webhooks/whatsapp`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': `sha256=${signature}` },
    body, signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Webhook retornou HTTP ${response.status}.`);
  console.log('Mensagem fictícia recebida e persistida pela API.');
  const target = new URL(config.softwareUrl);
  if (!['localhost', '127.0.0.1'].includes(target.hostname) || process.argv.includes('--no-wait')) {
    console.log('Confira a entrega no software receptor.');
  } else {
    const deadline = Date.now() + 45000;
    let found = false;
    while (Date.now() < deadline) {
      await setTimeout(1000);
      try {
        const received = await fetch(config.softwareUrl, { headers: { Authorization: `Bearer ${config.softwareToken}` }, signal: AbortSignal.timeout(2000) });
        if (!received.ok) continue;
        const data = await received.json() as { events?: unknown[] };
        for (const raw of data.events || []) {
          const parsed = integrationEventSchema.safeParse(raw);
          if (parsed.success && parsed.data.messages.some(message => message.id === messageId)) {
            console.log(JSON.stringify(parsed.data, null, 2));
            if (parsed.data.extraction_status === 'failed') process.exitCode = 1;
            found = true;
            break;
          }
        }
      } catch { /* O receptor pode estar iniciando; a entrega continua na fila. */ }
      if (found) break;
    }
    if (!found) throw new Error('Entrega não observada em 45s. Verifique o receptor e use npm.cmd run replay -- --list.');
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Falha na demonstração.');
  process.exitCode = 1;
}
