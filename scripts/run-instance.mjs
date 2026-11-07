import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { watch } from 'node:fs';

const require = createRequire(import.meta.url);
const [provider, command, port] = process.argv.slice(2);
if (!['demo', 'supabase'].includes(provider) || !['dev', 'start'].includes(command) || !/^\d{4,5}$/.test(port || '')) {
 console.error('Uso: node scripts/run-instance.mjs <demo|supabase> <dev|start> <porta>');
 process.exit(1);
}
console.log(`Divas Black: ${provider === 'demo' ? 'demonstração local' : 'conexão Supabase'} em http://localhost:${port}`);
let child, watcher, timer, restarting = false, stopping = false;
function launch() {
 child = spawn(process.execPath, [require.resolve('next/dist/bin/next'), command, '--hostname', '0.0.0.0', '--port', port], {
  env: { ...process.env, DATA_PROVIDER: provider }, stdio: 'inherit', windowsHide: true,
 });
 child.on('error', () => { console.error('Não foi possível iniciar o aplicativo.'); watcher?.close(); process.exitCode = 1; });
 child.on('exit', (code) => {
  if (restarting && !stopping) { restarting = false; launch(); }
  else { watcher?.close(); process.exitCode = code ?? 0; }
 });
}
if (provider === 'supabase' && command === 'start') {
 watcher = watch(process.cwd(), (_event, filename) => {
  if (!['.env', '.env.local'].includes(String(filename)) || stopping) return;
  clearTimeout(timer);
  timer = setTimeout(() => {
   console.log('Configuração de ambiente atualizada. Reiniciando a conexão Supabase…');
   restarting = true;
   if (child && !child.killed) child.kill('SIGTERM');
  }, 500);
 });
}
launch();
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { stopping = true; clearTimeout(timer); watcher?.close(); if (child && !child.killed) child.kill(signal); });
