import { mkdirSync, writeFileSync } from 'node:fs';
import { z } from 'zod';
import { integrationEventSchema } from '../src/types.ts';

mkdirSync('docs', { recursive: true });
writeFileSync('docs/event.schema.json', `${JSON.stringify(z.toJSONSchema(integrationEventSchema, { target: 'draft-7' }), null, 2)}\n`);
console.log('Contrato gerado em docs/event.schema.json.');
