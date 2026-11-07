import { port } from './config.ts';
import { openDatabase } from './store.ts';
import { createReceiverApp } from './receiver-app.ts';

try {
  const db = openDatabase(process.env.RECEIVER_DATABASE_PATH || './data/receiver.sqlite');
  const receiverPort = port(process.env.RECEIVER_PORT, 3002);
  const app = createReceiverApp(db, process.env.SOFTWARE_API_TOKEN || '');
  const server = app.listen(receiverPort, '127.0.0.1', () => console.log(`Receptor de teste: http://127.0.0.1:${receiverPort}/integrations/whatsapp/events`));
  server.on('error', error => { console.error(`Falha no receptor: ${error.message}`); db.close(); process.exitCode = 1; });
  const stop = () => { server.close(() => db.close()); };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
} catch (error) { console.error(error instanceof Error ? error.message : 'Falha no receptor.'); process.exitCode = 1; }
