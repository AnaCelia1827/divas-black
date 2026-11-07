import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { extractText, validateExtraction } from '../lib/extract-text';
import { MESSAGE_EXAMPLE } from '../lib/text-draft';
import { POST } from '../app/api/assistant/extract/route';
import { fields, rawFields } from './text-fixtures';

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const completion = (content: unknown = rawFields(), finish_reason = 'stop') => new Response(JSON.stringify({ choices: [{ finish_reason, message: { content: JSON.stringify(content) } }] }));
const request = (body: unknown, origin = 'http://localhost:3000') => new NextRequest('http://localhost:3000/api/assistant/extract', { method: 'POST', headers: { 'Content-Type': 'application/json', origin }, body: JSON.stringify(body) });

describe('extração da mensagem digitada', () => {
 it('extrai o exemplo em centavos e mantém o horário pendente', () => {
  expect(validateExtraction(rawFields(), MESSAGE_EXAMPLE)).toEqual(fields);
 });
 it('não inventa ano, horário, serviço ou valores sem evidência', () => {
  const raw = rawFields(); raw.date.source = '07/11'; raw.time = { value: '09:00', source: 'Maria' };
  raw.serviceName.value = 'Box Braids'; raw.totalCents.value = 99900;
  const result = validateExtraction(raw, MESSAGE_EXAMPLE.replace('07/11/2026', '07/11'));
  expect(result).toMatchObject({ date: null, time: null, serviceName: null, totalCents: null });
 });
 it('normaliza horário explícito, rejeita data impossível e não calcula parcela ausente', () => {
  const raw = rawFields(); raw.time = { value: '16:00', source: 'às 16' };
  raw.date = { value: '2026-02-31', source: '31/02/2026' }; raw.finalCents = { value: null, source: null };
  const result = validateExtraction(raw, MESSAGE_EXAMPLE.replace('07/11/2026', '31/02/2026') + ' às 16');
  expect(result).toMatchObject({ date: null, time: '16:00', finalCents: null });
 });
 it('sinaliza divergência financeira sem corrigir os valores automaticamente', () => {
  const raw = rawFields(); raw.finalCents = { value: 13000, source: 'R$130,00' };
  const result = validateExtraction(raw, MESSAGE_EXAMPLE.replace('R$120,00', 'R$130,00'));
  expect(result.finalCents).toBe(13000); expect(result.warnings.join(' ')).toContain('não somam');
 });
 it('usa somente a Groq no servidor com schema estrito', async () => {
  vi.stubEnv('GROQ_API_KEY', 'server-test-key');
  const fetcher = vi.fn().mockResolvedValue(completion()); vi.stubGlobal('fetch', fetcher);
  expect(await extractText(MESSAGE_EXAMPLE)).toEqual(fields);
  const [url, options] = fetcher.mock.calls[0]; const body = JSON.parse(options.body);
  expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');
  expect(options.headers.Authorization).toBe('Bearer server-test-key');
  expect(body.response_format.json_schema.strict).toBe(true);
  expect(body.messages[1].content).toBe(MESSAGE_EXAMPLE);
 });
 it('não retorna segredos nem dados inventados quando a IA falha', async () => {
  vi.stubEnv('GROQ_API_KEY', 'server-secret');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('server-secret', { status: 429 })));
  const response = await POST(request({ message: MESSAGE_EXAMPLE }));
  expect(response.status).toBe(503); expect(JSON.stringify(await response.json())).not.toContain('server-secret');
 });
 it('recusa resposta incompleta ou fora do contrato', async () => {
  vi.stubEnv('GROQ_API_KEY', 'server-test-key');
  const fetcher = vi.fn().mockResolvedValueOnce(completion(rawFields(), 'length')).mockResolvedValueOnce(completion({ wrong: 'data' })); vi.stubGlobal('fetch', fetcher);
  await expect(extractText(MESSAGE_EXAMPLE)).rejects.toThrow('Não foi possível organizar');
  await expect(extractText(MESSAGE_EXAMPLE)).rejects.toThrow('Não foi possível organizar');
 });
 it('valida origem e tamanho real antes de consultar a IA', async () => {
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  expect((await POST(request({ message: MESSAGE_EXAMPLE }, 'https://other.example'))).status).toBe(403);
  expect((await POST(request({ message: '' }))).status).toBe(400);
  expect((await POST(request({ message: 'a'.repeat(4001) }))).status).toBe(400);
  expect((await POST(request({ message: 'a'.repeat(25000) }))).status).toBe(413);
  expect(fetcher).not.toHaveBeenCalled();
 });
 it('retorna extração sem gravar atendimento e avisa quando falta a chave', async () => {
  vi.stubEnv('GROQ_API_KEY', '');
  expect((await POST(request({ message: MESSAGE_EXAMPLE }))).status).toBe(503);
  vi.stubEnv('GROQ_API_KEY', 'server-test-key'); vi.stubGlobal('fetch', vi.fn().mockResolvedValue(completion()));
  const response = await POST(request({ message: MESSAGE_EXAMPLE }));
  expect(response.headers.get('Cache-Control')).toBe('no-store'); expect(await response.json()).toEqual({ extraction: fields });
 });
 it('aceita a origem local por IP sem confundir a normalização de localhost do Next', async () => {
  vi.stubEnv('GROQ_API_KEY', 'server-test-key'); vi.stubGlobal('fetch', vi.fn().mockResolvedValue(completion()));
  const local = new NextRequest('http://127.0.0.1:3004/api/assistant/extract', { method: 'POST', headers: { host: '127.0.0.1:3004', origin: 'http://127.0.0.1:3004', 'Content-Type': 'application/json' }, body: JSON.stringify({ message: MESSAGE_EXAMPLE }) });
  expect((await POST(local)).status).toBe(200);
 });
});
