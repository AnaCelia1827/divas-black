import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const env = `# Apenas demonstração local. META_APP_SECRET abaixo NÃO é uma credencial real da Meta.
PORT=3001
HOST=127.0.0.1
DATABASE_PATH=./data/whatsapp.sqlite
META_APP_SECRET=${randomBytes(24).toString('hex')}
WHATSAPP_VERIFY_TOKEN=${randomBytes(24).toString('hex')}
WHATSAPP_PHONE_NUMBER_ID=
# Se OPENAI_API_KEY já estiver no ambiente, não é necessário gravá-la neste arquivo.
# OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.4-mini
SALON_ADDRESS=
SOFTWARE_WEBHOOK_URL=http://127.0.0.1:3002/integrations/whatsapp/events
SOFTWARE_API_TOKEN=${randomBytes(24).toString('hex')}
RECEIVER_PORT=3002
RECEIVER_DATABASE_PATH=./data/receiver.sqlite
`;
try {
  writeFileSync('.env', env, { flag: 'wx' });
  console.log('.env de demonstração criado, sem alterar arquivos existentes nem exibir segredos.');
  console.log('Inicie npm.cmd run receiver e npm.cmd start em terminais separados. Depois rode npm.cmd run demo.');
} catch (error) {
  if ((error as NodeJS.ErrnoException).code === 'EEXIST') console.log('.env já existe: arquivo preservado.');
  else { console.error('Não foi possível criar .env.'); process.exitCode = 1; }
}
