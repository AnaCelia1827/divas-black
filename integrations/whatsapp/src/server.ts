import { loadConfig } from './config.ts';
import { Store } from './store.ts';
import { createWebhookApp } from './webhook.ts';
import { createOpenAIExtractor } from './extraction.ts';
import { Worker } from './worker.ts';

try {
  const config = loadConfig();
  const store = new Store(config.databasePath);
  const worker = new Worker(store, createOpenAIExtractor(config), config);
  const server = createWebhookApp(store, config).listen(config.port, config.host, () => {
    console.log(`API local: http://${config.host}:${config.port}; webhook: /webhooks/whatsapp`);
    if (!config.openaiKey) console.warn('OPENAI_API_KEY ausente: mensagens serão entregues com extraction_status=failed.');
    worker.start();
  });
  server.on('error', error => { console.error(`Não foi possível iniciar a API: ${error.message}`); store.close(); process.exitCode = 1; });
  let stopping = false;
  const stop = () => {
    if (stopping) return;
    stopping = true;
    server.close(() => { void worker.stop().finally(() => store.close()); });
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Falha de configuração.');
  process.exitCode = 1;
}
