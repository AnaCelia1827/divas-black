import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeWebhook } from '../src/webhook.ts';
import { buildContext, createOpenAIExtractor } from '../src/extraction.ts';

try {
  if (!process.env.OPENAI_API_KEY) throw new Error('Configure OPENAI_API_KEY para executar o teste real.');
  const fixture = JSON.parse(readFileSync(new URL('../examples/whatsapp-message.json', import.meta.url), 'utf8'));
  const { messages } = normalizeWebhook(fixture, Date.now());
  const context = buildContext({ conversation_id: messages[0]!.conversation_id, source_revision: 1, total_messages: 1, messages });
  const extraction = await createOpenAIExtractor({
    openaiKey: process.env.OPENAI_API_KEY, openaiModel: process.env.OPENAI_MODEL || 'gpt-5.4-mini', salonAddress: undefined,
  })(context);
  assert.equal(extraction.atendimento?.cliente.nome, 'Maria');
  assert.equal(extraction.atendimento?.cliente.telefone, null);
  assert.equal(extraction.atendimento?.data_informada, '07/11');
  assert.equal(extraction.atendimento?.data_atendimento, null);
  assert.equal(extraction.atendimento?.hora_atendimento, '16:00');
  assert.equal(extraction.atendimento?.localizacao.tipo, 'salao');
  assert.equal(extraction.atendimento?.localizacao.endereco, null);
  assert.match(extraction.atendimento?.servico || '', /tranças boxeadoras/i);
  assert.equal(extraction.atendimento?.requer_revisao, true);
  console.log('Teste real de extração aprovado.');
  console.log(JSON.stringify(extraction, null, 2));
} catch (error) {
  // Nunca exibir stack/headers de requisições autenticadas.
  console.error(error instanceof Error ? error.message : 'Falha no teste real.');
  process.exitCode = 1;
}
