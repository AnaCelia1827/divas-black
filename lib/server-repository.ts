import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { createVersionedRepository, type SnapshotStore } from './versioned-repository';
import type { AppData, Command } from './types';

function repository() {
  if (typeof window !== 'undefined') throw new Error('Este módulo só pode acessar o banco pelo servidor.');
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('Banco não configurado. Defina SUPABASE_URL e SUPABASE_SECRET_KEY no servidor.');
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) } });
  const store: SnapshotStore = {
    async read() {
      const { data, error } = await client.from('divas_demo_state').select('revision,payload').eq('id', 'demo').maybeSingle();
      if (error) throw new Error('Não foi possível consultar o banco. Confira a configuração e a migração.');
      return data ? { revision: Number(data.revision), payload: data.payload } : null;
    },
    async initialize(data: AppData) {
      const { error } = await client.from('divas_demo_state').insert({ id: 'demo', revision: 0, payload: data });
      if (error && error.code !== '23505') throw new Error('Não foi possível criar os dados de demonstração.');
    },
    async compareAndSwap(revision, payload) {
      const { data, error } = await client.rpc('divas_save_demo', { expected_revision: revision, next_payload: payload });
      if (error) throw new Error('Não foi possível salvar no banco. Nenhuma confirmação foi enviada.');
      return data === true;
    },
  };
  return createVersionedRepository(store);
}

export async function loadServerData(): Promise<AppData> { return repository().load(); }
export async function executeServerCommand(command: Command): Promise<AppData> { return repository().execute(command); }
