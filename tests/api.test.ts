import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '../app/api/data/route';
import { loadServerData, executeServerCommand } from '../lib/server-repository';
import { createSeedData } from '../lib/seed';
vi.mock('../lib/server-repository', () => ({ loadServerData: vi.fn(), executeServerCommand: vi.fn() }));

describe('API de dados', () => {
 beforeEach(() => { vi.clearAllMocks(); vi.stubEnv('DATA_PROVIDER', 'demo'); });
 afterEach(() => { vi.unstubAllEnvs(); });
 const request = (body: unknown, origin = 'http://localhost:3000') => new NextRequest('http://localhost:3000/api/data', { method: 'POST', headers: { 'content-type': 'application/json', origin }, body: JSON.stringify(body) });
 const command = { commandId: 'command-api', type: 'saveClient', client: { id: 'test-client', name: 'Cliente fictícia', phone: '', notes: '', active: true } };

 it('informa demo sem consultar banco ou enviar segredos', async () => {
  const response = await GET();
  expect(await response.json()).toEqual({ mode: 'demo', data: null });
  expect(loadServerData).not.toHaveBeenCalled();
  expect(response.headers.get('cache-control')).toBe('no-store');
 });
 it('entrega os dados do banco no modo Supabase', async () => {
  vi.stubEnv('DATA_PROVIDER', 'supabase');
  const data = createSeedData(); vi.mocked(loadServerData).mockResolvedValue(data);
  expect(await (await GET()).json()).toEqual({ mode: 'supabase', data });
 });
 it('não retorna demo nem detalhes de segredo se o banco falhar', async () => {
  vi.stubEnv('DATA_PROVIDER', 'supabase');
  vi.mocked(loadServerData).mockRejectedValue(new Error('secret-value database unavailable'));
  const response = await GET(); const body = await response.json();
  expect(response.status).toBe(503); expect(body.mode).toBe('supabase');
  expect(JSON.stringify(body)).not.toContain('secret-value');
 });
 it('rejeita provedor inválido', async () => {
  vi.stubEnv('DATA_PROVIDER', 'invalid');
  expect((await GET()).status).toBe(503);
 });
 it('rejeita gravação HTTP em demo', async () => {
  expect((await POST(request(command))).status).toBe(400);
  expect(executeServerCommand).not.toHaveBeenCalled();
 });
 it('rejeita origem diferente antes de gravar', async () => {
  vi.stubEnv('DATA_PROVIDER', 'supabase');
  expect((await POST(request(command, 'https://other.example'))).status).toBe(403);
  expect(executeServerCommand).not.toHaveBeenCalled();
 });
 it('valida dados e devolve erro legível sem gravar', async () => {
  vi.stubEnv('DATA_PROVIDER', 'supabase');
  const response = await POST(request({ ...command, client: { ...command.client, name: '' } }));
  expect(response.status).toBe(400); expect(executeServerCommand).not.toHaveBeenCalled();
 });
 it('grava comando validado uma vez', async () => {
  vi.stubEnv('DATA_PROVIDER', 'supabase'); const data = createSeedData();
  vi.mocked(executeServerCommand).mockResolvedValue(data);
  const response = await POST(request(command));
  expect(response.status).toBe(200); expect(executeServerCommand).toHaveBeenCalledExactlyOnceWith(command);
  expect(await response.json()).toEqual({ data });
 });
 it('preserva erro da regra de negócio para correção do formulário', async () => {
  vi.stubEnv('DATA_PROVIDER', 'supabase');
  vi.mocked(executeServerCommand).mockRejectedValue(new Error('Esse horário já está ocupado. Escolha outro horário.'));
  const response = await POST(request(command));
  expect(response.status).toBe(400); expect((await response.json()).error).toContain('ocupado');
 });
});
