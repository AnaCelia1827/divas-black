// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useApp } from '../lib/use-app';
import { createSeedData } from '../lib/seed';
import type { Command } from '../lib/types';

const clientCommand = (id = 'hook-client'): Extract<Command, {type: 'saveClient'}> => ({ commandId: `save-${id}`, type: 'saveClient', client: { id, name: 'Cliente da interface', phone: '', notes: '', active: true } });
describe('integração da interface com persistência', () => {
 beforeEach(() => {
  window.localStorage.clear();
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response(JSON.stringify({ mode: 'demo', data: null }), { headers: { 'Content-Type': 'application/json' } })));
 });
 afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
 it('carrega demo, salva pela interface e recupera ao remontar', async () => {
  const first = renderHook(() => useApp());
  await waitFor(() => expect(first.result.current.loading).toBe(false));
  expect(first.result.current.mode).toBe('demo');
  await act(async () => { expect(await first.result.current.execute(clientCommand())).toBe(true); });
  expect(first.result.current.data?.clients.some(client => client.id === 'hook-client')).toBe(true);
  first.unmount();
  const second = renderHook(() => useApp());
  await waitFor(() => expect(second.result.current.loading).toBe(false));
  expect(second.result.current.data?.clients.some(client => client.id === 'hook-client')).toBe(true);
 });
 it('bloqueia duas ações simultâneas e libera o botão após salvar', async () => {
  const hook = renderHook(() => useApp()); await waitFor(() => expect(hook.result.current.loading).toBe(false));
  let results: boolean[] = [];
  await act(async () => { results = await Promise.all([hook.result.current.execute(clientCommand('one')), hook.result.current.execute(clientCommand('two'))]); });
  expect(results).toEqual([true, false]); expect(hook.result.current.busy).toBe(false);
  expect(hook.result.current.data?.clients.some(client => client.id === 'one')).toBe(true);
  expect(hook.result.current.data?.clients.some(client => client.id === 'two')).toBe(false);
 });
 it('mantém dados e mostra erro se o navegador não conseguir salvar', async () => {
  const hook = renderHook(() => useApp()); await waitFor(() => expect(hook.result.current.loading).toBe(false));
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
  await act(async () => { expect(await hook.result.current.execute(clientCommand())).toBe(false); });
  expect(hook.result.current.error).toContain('Não foi possível salvar');
  expect(hook.result.current.data?.clients.some(client => client.id === 'hook-client')).toBe(false);
 });
 it('mostra falha do banco sem criar dados demo', async () => {
  vi.mocked(fetch).mockImplementation(async () => new Response(JSON.stringify({ error: 'Banco indisponível. Tente novamente.' }), { status: 503 }));
  const hook = renderHook(() => useApp()); await waitFor(() => expect(hook.result.current.loading).toBe(false));
  expect(hook.result.current.data).toBeNull(); expect(hook.result.current.error).toContain('Banco indisponível');
  expect(window.localStorage.length).toBe(0);
 });
 it('em Supabase envia o comando pelo servidor e atualiza o estado', async () => {
  const data = createSeedData(); const updated = { ...data, clients: [...data.clients, { ...clientCommand().client, createdAt: new Date().toISOString() }] };
  vi.mocked(fetch).mockImplementation(async (_url, init) => new Response(JSON.stringify(init?.method === 'POST' ? { data: updated } : { mode: 'supabase', data })));
  const hook = renderHook(() => useApp()); await waitFor(() => expect(hook.result.current.loading).toBe(false));
  expect(hook.result.current.mode).toBe('supabase');
  await act(async () => { expect(await hook.result.current.execute(clientCommand())).toBe(true); });
  expect(hook.result.current.data?.clients.some(client => client.id === 'hook-client')).toBe(true);
  expect(fetch).toHaveBeenCalledWith('/api/data', expect.objectContaining({ method: 'POST', body: JSON.stringify(clientCommand()) }));
  expect(window.localStorage.length).toBe(0);
 });
});
