import { applyCommand } from './domain';
import { createSeedData } from './seed';
import { parseAppData, parseCommand } from './validation';
import type { AppData, AppRepository } from './types';

export interface Snapshot { revision: number; payload: unknown }
export interface SnapshotStore {
  read(): Promise<Snapshot | null>;
  initialize(data: AppData): Promise<void>;
  compareAndSwap(revision: number, data: AppData): Promise<boolean>;
}

/** A single atomic snapshot keeps cash, stock and command deduplication consistent. */
export function createVersionedRepository(store: SnapshotStore): AppRepository {
  async function current() {
    let value = await store.read();
    if (!value) {
      await store.initialize(createSeedData());
      value = await store.read();
    }
    if (!value) throw new Error('Não foi possível iniciar o banco de demonstração.');
    if (!Number.isSafeInteger(value.revision) || value.revision < 0) throw new Error('Versão de dados inválida.');
    return { revision: value.revision, data: parseAppData(value.payload) };
  }
  return {
    async load() { return (await current()).data; },
    async execute(input) {
      const command = parseCommand(input);
      for (let attempt = 0; attempt < 8; attempt++) {
        const snapshot = await current();
        const next = applyCommand(snapshot.data, command);
        if (next === snapshot.data) return next;
        if (await store.compareAndSwap(snapshot.revision, next)) return next;
      }
      throw new Error('Outra alteração aconteceu ao mesmo tempo. Tente salvar novamente.');
    },
  };
}
