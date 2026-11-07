import { NextRequest, NextResponse } from 'next/server';
import { executeServerCommand, loadServerData } from '@/lib/server-repository';
import { parseCommand } from '@/lib/validation';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function provider() {
 const value = process.env.DATA_PROVIDER || 'demo';
 if (value !== 'demo' && value !== 'supabase') throw new Error('DATA_PROVIDER deve ser demo ou supabase.');
 return value;
}
export async function GET() {
 let mode: 'demo' | 'supabase' | undefined;
 try {
  mode = provider();
  return NextResponse.json({ mode, data: mode === 'supabase' ? await loadServerData() : null }, { headers: { 'Cache-Control': 'no-store' } });
 } catch { return NextResponse.json({ mode, error: 'Não foi possível conectar ao banco. Confira a configuração do Supabase e tente novamente.' }, { status: 503 }); }
}
export async function POST(request: NextRequest) {
 try {
  const origin = request.headers.get('origin');
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ error: 'Origem da solicitação inválida.' }, { status: 403 });
  if (provider() !== 'supabase') return NextResponse.json({ error: 'O modo demo salva os dados neste navegador.' }, { status: 400 });
  if (Number(request.headers.get('content-length') || 0) > 64_000) return NextResponse.json({ error: 'Solicitação muito grande.' }, { status: 413 });
  const command = parseCommand(await request.json());
  return NextResponse.json({ data: await executeServerCommand(command) }, { headers: { 'Cache-Control': 'no-store' } });
 } catch (error) {
  const message = error instanceof Error ? error.message : 'Não foi possível salvar.';
  const infrastructure = /fetch|supabase|database|banco|connect|configur|environment|chave|servidor|rpc|version|conexão/i.test(message);
  return NextResponse.json({ error: infrastructure ? 'Não foi possível salvar no banco. Confira a conexão e tente novamente.' : message }, { status: infrastructure ? 503 : 400 });
 }
}
