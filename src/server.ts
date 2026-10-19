import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig } from './config.ts';
import { openDb } from './db/index.ts';
import { createApp } from './app.ts';
import { serve } from './http/serve.ts';

if (existsSync('.env')) process.loadEnvFile('.env');
const config = loadConfig(process.env);
mkdirSync(join(config.dataDir, 'media'), { recursive: true });
const db = openDb(join(config.dataDir, 'carte.db'));
const mailer = { send: async () => { throw new Error('SMTP non configuré'); } };
const app = createApp({ db, config, now: () => new Date(), fetch, mailer });
serve(app, config.port, config.baseUrl);
console.log(`Carte QR en écoute sur le port ${config.port}`);
