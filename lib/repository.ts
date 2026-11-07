import { applyCommand } from './domain';
import { createSeedData } from './seed';
import { parseAppData, parseCommand } from './validation';
import type { AppRepository } from './types';

export const DEMO_STORAGE_KEY = 'divas-black:demo:v1';
type BrowserStorage = Pick<Storage, 'getItem' | 'setItem'>;

/** Browser storage is accessed on load/execute, never while importing or during SSR. */
export function createDemoRepository(providedStorage?: BrowserStorage): AppRepository {
  function storage(): BrowserStorage {
    if (providedStorage) return providedStorage;
    if (typeof window === 'undefined') throw new Error('A demonstração local funciona no navegador.');
    try { return window.localStorage; } catch { throw new Error('Permita o armazenamento do navegador para salvar a demonstração.'); }
  }
  function read() {
    let value: string | null;
    try { value = storage().getItem(DEMO_STORAGE_KEY); } catch (error) { if (error instanceof Error && error.message.includes('demonstração')) throw error; throw new Error('Não foi possível ler os dados deste navegador.'); }
    if (value === null) {
      const seed = createSeedData();
      write(seed);
      return seed;
    }
    let input: unknown;
    try { input = JSON.parse(value); } catch { throw new Error('Os dados locais estão corrompidos. Eles foram preservados para recuperação.'); }
    return parseAppData(input);
  }
  function write(data: ReturnType<typeof createSeedData>) {
    try { storage().setItem(DEMO_STORAGE_KEY, JSON.stringify(data)); } catch { throw new Error('Não foi possível salvar. Verifique o espaço e as permissões do navegador.'); }
  }
  return {
    async load() { return read(); },
    async execute(input) {
      const command = parseCommand(input);
      const save = () => {
        const current = read();
        const next = applyCommand(current, command);
        if (next !== current) write(next);
        return next;
      };
      if (typeof navigator !== 'undefined' && navigator.locks?.request) return navigator.locks.request(DEMO_STORAGE_KEY, save);
      return save();
    },
  };
}
