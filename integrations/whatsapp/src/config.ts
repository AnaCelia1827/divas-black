export interface Config {
  port: number;
  host: string;
  databasePath: string;
  appSecret: string;
  verifyToken: string;
  phoneNumberId: string | undefined;
  groqKey: string;
  groqModel: string;
  salonAddress: string | undefined;
  softwareUrl: string;
  softwareToken: string;
  debounceMs: number;
}

export const DEFAULT_GROQ_MODEL = 'openai/gpt-oss-20b';

export function loadGroqConfig(env: NodeJS.ProcessEnv = process.env) {
  return {
    groqKey: env.GROQ_API_KEY?.trim() || '',
    groqModel: env.GROQ_MODEL?.trim() || DEFAULT_GROQ_MODEL,
  };
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`Configure ${name} no ambiente ou em .env.`);
  return value;
}

export function port(value: string | undefined, fallback: number): number {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) throw new Error('Porta inválida.');
  return parsed;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const softwareUrl = env.SOFTWARE_WEBHOOK_URL || 'http://127.0.0.1:3002/integrations/whatsapp/events';
  const url = new URL(softwareUrl);
  const local = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(local && url.protocol === 'http:')) || url.username || url.password) {
    throw new Error('SOFTWARE_WEBHOOK_URL exige HTTPS, exceto no receptor local. Não use credenciais na URL.');
  }
  return {
    port: port(env.PORT, 3001), host: env.HOST || '127.0.0.1',
    databasePath: env.DATABASE_PATH || './data/whatsapp.sqlite',
    appSecret: required(env, 'META_APP_SECRET'),
    verifyToken: required(env, 'WHATSAPP_VERIFY_TOKEN'),
    phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID || undefined,
    ...loadGroqConfig(env),
    salonAddress: env.SALON_ADDRESS?.trim() || undefined,
    softwareUrl, softwareToken: required(env, 'SOFTWARE_API_TOKEN'), debounceMs: 5000,
  };
}
