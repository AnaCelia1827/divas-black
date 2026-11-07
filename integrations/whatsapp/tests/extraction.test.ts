import test from 'node:test';
import assert from 'node:assert/strict';
import { buildContext, createGroqExtractor, normalizeExtraction } from '../src/extraction.ts';
import { DEFAULT_GROQ_MODEL, loadGroqConfig } from '../src/config.ts';
import { extraction, message } from './helpers.ts';

test('Maria: preserva serviço, não inventa ano/endereço e não usa telefone do remetente', () => {
  const source = message();
  const input = extraction();
  input.atendimento!.cliente.telefone = source.sender.wa_id;
  input.atendimento!.data_atendimento = '2026-11-07';
  input.evidencias.push({ campo: 'data_atendimento', message_ids: ['m1'] });
  input.atendimento!.localizacao.endereco = 'Endereço inventado';
  const result = normalizeExtraction(input, { messages: [source], truncated: false }).atendimento!;
  assert.equal(result.cliente.nome, 'Maria'); assert.equal(result.cliente.telefone, null);
  assert.equal(result.data_atendimento, null); assert.equal(result.hora_atendimento, '16:00');
  assert.equal(result.localizacao.endereco, null); assert.equal(result.servico, 'Tranças boxeadoras');
  assert.ok(result.pendencias.includes('Confirmar o ano do atendimento'));
  assert.equal(normalizeExtraction(extraction(), { messages: [source], truncated: false }, 'Rua de exemplo, 10').atendimento!.localizacao.endereco, 'Rua de exemplo, 10');
});

test('ano explícito é aceito; data impossível ou horário inválido viram pendência', () => {
  const source = { ...message(), text: 'Maria, 07/11/2026 às 16:00, tranças boxeadoras no salão.' };
  const input = extraction();
  input.atendimento!.data_atendimento = '2026-11-07';
  input.evidencias.push({ campo: 'data_atendimento', message_ids: ['m1'] });
  assert.equal(normalizeExtraction(input, { messages: [source], truncated: false }).atendimento!.data_atendimento, '2026-11-07');
  input.atendimento!.data_atendimento = '2026-02-30'; input.atendimento!.hora_atendimento = '25:00';
  const result = normalizeExtraction(input, { messages: [source], truncated: false }).atendimento!;
  assert.equal(result.data_atendimento, null); assert.equal(result.hora_atendimento, null);
});

test('evidência inexistente é rejeitada e campo sem fonte fica vazio', () => {
  const input = extraction(); input.evidencias[0]!.message_ids = ['not-in-context'];
  assert.throws(() => normalizeExtraction(input, { messages: [message()], truncated: false }), /invalid_evidence/);
  const unsupported = extraction(); unsupported.evidencias = [];
  const result = normalizeExtraction(unsupported, { messages: [message()], truncated: false }).atendimento!;
  assert.equal(result.cliente.nome, null); assert.equal(result.servico, null); assert.equal(result.data_informada, null);
});

test('não troca tranças boxeadoras por box braids mesmo com evidência declarada pela IA', () => {
  const input = extraction(); input.atendimento!.servico = 'Box braids';
  const result = normalizeExtraction(input, { messages: [message()], truncated: false }).atendimento!;
  assert.equal(result.servico, null); assert.ok(result.pendencias.includes('Confirmar o serviço'));
});

test('contexto tem até 20 mil caracteres e prioriza mensagens recentes', () => {
  const old = { ...message('old'), text: 'a'.repeat(30000) };
  const latest = { ...message('latest'), text: 'Confirmado às 16:00' };
  const context = buildContext({ conversation_id: old.conversation_id, source_revision: 2, total_messages: 2, messages: [old, latest] });
  assert.ok(JSON.stringify(context.messages).length <= 20000);
  assert.equal(context.truncated, true); assert.equal(context.messages.at(-1)?.id, 'latest');
  assert.equal(context.messages[0]?.metadata.text_truncated, true);
});

test('envia somente à Groq com a chave própria, JSON Schema estrito e valida o resultado', async () => {
  let called = false;
  const extract = createGroqExtractor({ groqKey: 'fake-groq', groqModel: DEFAULT_GROQ_MODEL, salonAddress: undefined }, async (url, options) => {
    called = true;
    const body = JSON.parse(String(options?.body));
    assert.equal(url, 'https://api.groq.com/openai/v1/chat/completions');
    assert.equal(new Headers(options?.headers).get('authorization'), 'Bearer fake-groq');
    assert.equal(options?.redirect, 'error');
    assert.equal(body.model, 'openai/gpt-oss-20b');
    assert.equal(body.response_format.type, 'json_schema');
    assert.equal(body.response_format.json_schema.strict, true);
    assert.equal(body.response_format.json_schema.schema.additionalProperties, false);
    assert.equal(body.reasoning_effort, 'low');
    assert.equal(body.temperature, 0);
    assert.equal(body.stream, false);
    assert.equal(body.messages[0].role, 'system');
    assert.equal(body.messages[1].role, 'user');
    assert.equal(body.instructions, undefined);
    assert.equal(body.text, undefined);
    return Response.json({ choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: JSON.stringify(extraction()) } }] });
  });
  assert.equal((await extract({ messages: [message()], truncated: false })).atendimento?.cliente.nome, 'Maria');
  assert.equal(called, true);
});

test('mídia não chama IA; falha e resposta incompleta não geram dados falsos', async () => {
  const noCall = createGroqExtractor({ groqKey: '', groqModel: DEFAULT_GROQ_MODEL, salonAddress: undefined }, async () => { throw new Error('not expected'); });
  assert.deepEqual(await noCall({ messages: [{ ...message(), type: 'audio', text: null }], truncated: false }), { atendimento: null, evidencias: [] });
  await assert.rejects(noCall({ messages: [message()], truncated: false }), /missing_groq_key/);
  const incomplete = createGroqExtractor({ groqKey: 'fake', groqModel: DEFAULT_GROQ_MODEL, salonAddress: undefined }, async () => Response.json({ choices: [{ finish_reason: 'length', message: { role: 'assistant', content: JSON.stringify(extraction()) } }] }));
  await assert.rejects(incomplete({ messages: [message()], truncated: false }), /invalid_ai_output/);
});

test('configuração usa GROQ_API_KEY e ignora a chave herdada da OpenAI', () => {
  assert.deepEqual(loadGroqConfig({ OPENAI_API_KEY: 'old-key', OPENAI_MODEL: 'old-model' }), { groqKey: '', groqModel: DEFAULT_GROQ_MODEL });
  assert.deepEqual(loadGroqConfig({ GROQ_API_KEY: ' new-key ', GROQ_MODEL: 'openai/gpt-oss-120b', OPENAI_API_KEY: 'old-key' }),
    { groqKey: 'new-key', groqModel: 'openai/gpt-oss-120b' });
});

test('recusa, JSON inválido ou fora do schema são falhas de extração', async () => {
  for (const messageBody of [
    { role: 'assistant', content: null, refusal: 'refused' },
    { role: 'assistant', content: '{invalid-json' },
    { role: 'assistant', content: '{}' },
  ]) {
    const extract = createGroqExtractor({ groqKey: 'fake', groqModel: DEFAULT_GROQ_MODEL, salonAddress: undefined },
      async () => Response.json({ choices: [{ finish_reason: 'stop', message: messageBody }] }));
    await assert.rejects(extract({ messages: [message()], truncated: false }), /invalid_ai_output/);
  }
});

test('erros HTTP e de rede da Groq não expõem respostas ou credenciais', async () => {
  const config = { groqKey: 'fake', groqModel: DEFAULT_GROQ_MODEL, salonAddress: undefined };
  const blocked = createGroqExtractor(config, async () => Response.json({ error: { message: 'sensitive-response' } }, { status: 429 }));
  await assert.rejects(blocked({ messages: [message()], truncated: false }), error => {
    assert.equal((error as Error).message, 'ai_http_429'); return true;
  });
  const offline = createGroqExtractor(config, async () => { throw new Error('sensitive-network-details'); });
  await assert.rejects(offline({ messages: [message()], truncated: false }), /ai_network_or_timeout/);
});
