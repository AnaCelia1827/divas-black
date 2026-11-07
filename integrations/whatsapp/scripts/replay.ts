import { Store } from '../src/store.ts';

const store = new Store(process.env.DATABASE_PATH || './data/whatsapp.sqlite');
try {
  const arg = process.argv[2];
  if (!arg || arg === '--list') {
    const deliveries = store.db.prepare('SELECT event_id, revision, state, attempts, last_error FROM outbox ORDER BY rowid DESC LIMIT 50').all();
    console.table(deliveries);
    console.log('Reenviar falhas: npm.cmd run replay -- --all OU npm.cmd run replay -- <event_id>');
  } else {
    const count = store.replayFailed(Date.now(), arg === '--all' ? undefined : arg);
    console.log(`${count} entrega(s) com falha recolocada(s) na fila. A API precisa estar em execução.`);
  }
} finally { store.close(); }
