import test from 'node:test';
import assert from 'node:assert/strict';
import { buildContext, createOpenAIExtractor, normalizeExtraction } from '../src/extraction.ts';
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

test('usa saída estruturada, não armazena na OpenAI e valida o resultado', async () => {
  let called = false;
  const extract = createOpenAIExtractor({ openaiKey: 'fake', openaiModel: 'gpt-5.4-mini', salonAddress: undefined }, async (_url, options) => {
    called = true;
    const body = JSON.parse(String(options?.body));
    assert.equal(body.store, false); assert.equal(body.text.format.strict, true);
    return Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(extraction()) }] }] });
  });
  assert.equal((await extract({ messages: [message()], truncated: false })).atendimento?.cliente.nome, 'Maria');
  assert.equal(called, true);
});

test('mídia não chama IA; falha e resposta incompleta não geram dados falsos', async () => {
  const noCall = createOpenAIExtractor({ openaiKey: '', openaiModel: 'gpt-5.4-mini', salonAddress: undefined }, async () => { throw new Error('not expected'); });
  assert.deepEqual(await noCall({ messages: [{ ...message(), type: 'audio', text: null }], truncated: false }), { atendimento: null, evidencias: [] });
  await assert.rejects(noCall({ messages: [message()], truncated: false }), /missing_openai_key/);
  const incomplete = createOpenAIExtractor({ openaiKey: 'fake', openaiModel: 'gpt-5.4-mini', salonAddress: undefined }, async () => Response.json({ status: 'incomplete' }));
  await assert.rejects(incomplete({ messages: [message()], truncated: false }), /invalid_ai_output/);
});
