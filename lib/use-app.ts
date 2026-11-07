'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppData, AppRepository, Command } from './types';
import { createDemoRepository } from './repository';

export function useApp() {
 const [data, setData] = useState<AppData | null>(null);
 const [loading, setLoading] = useState(true);
 const [busy, setBusy] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const [mode, setMode] = useState<'demo' | 'supabase'>('demo');
 const repository = useRef<AppRepository | null>(null);
 const lock = useRef(false);
 const reload = useCallback(async () => {
  setLoading(true); setError(null);
  try {
   if (!repository.current) {
    const response = await fetch('/api/data', { cache: 'no-store' });
    const result = await response.json();
    if (result.mode === 'demo' || result.mode === 'supabase') setMode(result.mode);
    if (!response.ok) throw new Error(result.error || 'Não foi possível carregar os dados. Tente novamente.');
    const currentMode: 'demo' | 'supabase' = result.mode;
    setMode(currentMode);
    if (currentMode === 'demo') repository.current = createDemoRepository();
    else repository.current = {
     load: async () => {
      const res = await fetch('/api/data', { cache: 'no-store' });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'Não foi possível carregar os dados.');
      return payload.data;
     },
     execute: async (command: Command) => {
      const res = await fetch('/api/data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(command) });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'Não foi possível salvar. Tente novamente.');
      return payload.data;
     }
    };
   }
   setData(await repository.current.load());
  } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível carregar.'); }
  finally { setLoading(false); }
 }, []);
 useEffect(() => { void reload(); }, [reload]);
 useEffect(() => {
  const sync = (event: StorageEvent) => { if (mode === 'demo' && event.key?.startsWith('divas-black')) void reload(); };
  window.addEventListener('storage', sync);
  return () => window.removeEventListener('storage', sync);
 }, [reload, mode]);
 const execute = useCallback(async (command: Command): Promise<boolean> => {
  if (lock.current || !repository.current) return false;
  lock.current = true; setBusy(true); setError(null);
  try { setData(await repository.current.execute(command)); return true; }
  catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível salvar. Tente novamente.'); return false; }
  finally { lock.current = false; setBusy(false); }
 }, []);
 return { data, loading, error, busy, mode, execute, reload };
}
