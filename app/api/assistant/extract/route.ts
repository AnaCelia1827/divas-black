import { NextRequest, NextResponse } from 'next/server';
import { extractText, ExtractionError } from '@/lib/extract-text';
import { MAX_MESSAGE_LENGTH } from '@/lib/text-draft';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const MAX_BYTES = 24000;
export async function POST(request: NextRequest) {
 const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
 const origin = request.headers.get('origin');
 // NextURL normalizes 127.0.0.1 to localhost; compare with the actual HTTP host.
 const expectedOrigin = `${request.nextUrl.protocol}//${request.headers.get('host') || request.nextUrl.host}`;
 if (origin && origin !== expectedOrigin) return json({ error: 'Origem da solicitação inválida.' }, 403);
 if (Number(request.headers.get('content-length') || 0) > MAX_BYTES) return json({ error: 'Mensagem muito grande.' }, 413);
 try {
  const reader = request.body?.getReader();
  if (!reader) return json({ error: 'Envie uma mensagem.' }, 400);
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
   const { value, done } = await reader.read(); if (done) break;
   size += value.byteLength;
   if (size > MAX_BYTES) { await reader.cancel(); return json({ error: 'Mensagem muito grande.' }, 413); }
   chunks.push(value);
  }
  const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if (typeof body?.message !== 'string' || !body.message.trim() || body.message.length > MAX_MESSAGE_LENGTH) return json({ error: 'Envie uma mensagem de até 4.000 caracteres.' }, 400);
  return json({ extraction: await extractText(body.message.trim()) });
 } catch (error) {
  if (error instanceof ExtractionError) return json({ error: error.message }, error.status);
  return json({ error: 'Mensagem inválida. Confira o texto e tente novamente.' }, 400);
 }
}
