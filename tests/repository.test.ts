import { describe, expect, it } from 'vitest';
import { createDemoRepository, DEMO_STORAGE_KEY } from '../lib/repository';
import { createSeedData } from '../lib/seed';
import { createVersionedRepository, type Snapshot, type SnapshotStore } from '../lib/versioned-repository';
import type { AppData, Command } from '../lib/types';

function command(id: string): Command { return { commandId: `cmd-${id}`, type: 'recordCash', movement: { id, direction: 'in', amountCents: 10000, date: '2026-11-07', category: 'Outros', description: 'Teste' } }; }
function memoryStorage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
}
class MemoryStore implements SnapshotStore {
  state: Snapshot | null = { revision: 0, payload: createSeedData(new Date('2026-11-07T15:00:00Z')) };
  async read() { return structuredClone(this.state); }
  async initialize(data: AppData) { if (!this.state) this.state = { revision: 0, payload: structuredClone(data) }; }
  async compareAndSwap(revision: number, data: AppData) {
    if (this.state?.revision !== revision) return false;
    this.state = { revision: revision + 1, payload: structuredClone(data) };
    return true;
  }
}

describe('persistência local', () => {
  it('persiste entre instâncias e não depende do browser ao importar/criar', async () => {
    expect(() => createDemoRepository()).not.toThrow();
    const storage = memoryStorage();
    await createDemoRepository(storage).execute(command('persist'));
    const data = await createDemoRepository(storage).load();
    expect(data.cashMovements.some(item => item.id === 'persist')).toBe(true);
  });
  it('preserva armazenamento corrompido e informa o erro, sem reset silencioso', async () => {
    const storage = memoryStorage();
    storage.setItem(DEMO_STORAGE_KEY, '{broken');
    await expect(createDemoRepository(storage).load()).rejects.toThrow(/corrompidos/);
    expect(storage.getItem(DEMO_STORAGE_KEY)).toBe('{broken');
    storage.setItem(DEMO_STORAGE_KEY, JSON.stringify({ ...createSeedData(), schemaVersion: 99 }));
    await expect(createDemoRepository(storage).load()).rejects.toThrow(/versão/);
  });
  it('não informa sucesso quando armazenamento falha', async () => {
    const storage = { getItem: () => null, setItem: () => { throw new Error('quota'); } };
    await expect(createDemoRepository(storage).execute(command('failure'))).rejects.toThrow(/salvar/);
  });
});

describe('adaptador compartilhado com compare-and-swap', () => {
  it('reaplica comando sobre versão nova e não perde alterações concorrentes', async () => {
    const store = new MemoryStore();
    const repository = createVersionedRepository(store);
    await Promise.all([repository.execute(command('concurrent-a')), repository.execute(command('concurrent-b'))]);
    const data = await repository.load();
    expect(data.cashMovements.filter(item => item.id.startsWith('concurrent-'))).toHaveLength(2);
    expect(store.state?.revision).toBe(2);
  });
  it('duas requisições simultâneas do mesmo comando geram um lançamento', async () => {
    const store = new MemoryStore();
    const repository = createVersionedRepository(store);
    await Promise.all([repository.execute(command('same')), repository.execute(command('same'))]);
    expect((await repository.load()).cashMovements.filter(item => item.id === 'same')).toHaveLength(1);
    expect(store.state?.revision).toBe(1);
  });
  it('reporta conflito persistente sem sobrescrever outro escritor', async () => {
    const store = new MemoryStore();
    store.compareAndSwap = async () => false;
    await expect(createVersionedRepository(store).execute(command('conflict'))).rejects.toThrow(/mesmo tempo/);
    expect((await createVersionedRepository(store).load()).cashMovements.some(item => item.id === 'conflict')).toBe(false);
  });
});
