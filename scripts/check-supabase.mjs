import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { createClient } from '@supabase/supabase-js';

// Do not print URLs, keys, response bodies or raw errors: they can contain secrets.
const config = {};
for (const filename of ['.env', '.env.local']) {
 if (existsSync(filename)) Object.assign(config, parseEnv(readFileSync(filename, 'utf8')));
}
for (const name of ['SUPABASE_URL', 'SUPABASE_SECRET_KEY']) {
 if (process.env[name] !== undefined) config[name] = process.env[name];
}
const key = config.SUPABASE_SECRET_KEY || '';
let keyType = key.startsWith('sb_secret_') ? 'Secret' : key.startsWith('sb_publishable_') ? 'Publishable (pública)' : key ? 'formato não reconhecido' : 'não configurada';
if (key.split('.').length === 3) {
 try {
  const role = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role;
  keyType = role === 'service_role' ? 'service_role legada' : 'JWT sem privilégio service_role';
 } catch { /* The server validates unrecognized keys. */ }
}
function failure(message) { console.error(message); process.exitCode = 1; }
function reportError(label, result) {
 const code = /^[A-Za-z0-9_]+$/.test(result.error?.code || '') ? result.error.code : 'sem código';
 failure(`${label}: falhou (HTTP ${result.status}; ${code}).`);
 if (keyType === 'Publishable (pública)' || keyType === 'JWT sem privilégio service_role') {
  failure('O servidor precisa da chave Secret (sb_secret_...) em SUPABASE_SECRET_KEY, no .env.local da raiz deste projeto. A chave pública não tem acesso à tabela privada.');
 } else if (['PGRST205', 'PGRST202', '42P01', '42883', '42501'].includes(code)) {
  failure('Confira a tabela, a função e os grants de supabase/migrations/001_demo_state.sql no mesmo projeto.');
 } else if ([401,403].includes(result.status)) {
  failure('Confira se a chave Secret está ativa e pertence ao projeto de SUPABASE_URL.');
 } else {
  failure('Confira a conexão de rede e a disponibilidade do projeto Supabase.');
 }
}

console.log(`Tipo de chave: ${keyType}.`);
if (!config.SUPABASE_URL || !key) {
 failure('Preencha SUPABASE_URL e SUPABASE_SECRET_KEY no .env.local da raiz deste projeto.');
} else {
 try {
  const client = createClient(config.SUPABASE_URL, key, {
   auth: { persistSession: false, autoRefreshToken: false },
   global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store', signal: AbortSignal.timeout(15000) }) },
  });
  const read = await client.from('divas_demo_state').select('id,revision').eq('id', 'demo').maybeSingle();
  if (read.error) reportError('Leitura', read);
  else {
   console.log(`Leitura: OK${read.data ? ' (snapshot encontrado)' : ' (banco ainda sem snapshot)'}.`);
   // revision >= 0 is enforced by the migration. -1 never matches a row.
   // This checks permission to execute the save function without mutating data.
   const permission = await client.rpc('divas_save_demo', { expected_revision: -1, next_payload: { schemaVersion: 1 } });
   if (permission.error) reportError('Permissão da função de gravação', permission);
   else if (permission.data !== false) failure('Resposta inesperada da função de gravação. Confira se a migração corresponde ao projeto.');
   else console.log('Permissão da função de gravação: OK. Nenhum registro foi alterado.');
  }
 } catch {
  failure('Não foi possível concluir o diagnóstico. Confira o formato da URL e da chave, a rede e a disponibilidade do Supabase. Nenhuma credencial foi exibida.');
 }
}
