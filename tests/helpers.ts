import type { Config } from '../src/config.ts';

export const ENV: Record<string, string> = {
  BASE_URL: 'https://carte.test',
  PORT: '3000',
  DATA_DIR: '/tmp/carte-test',
  ADMIN_EMAIL: 'benjamin@test.ch',
  OWNER_NAME: 'Benjamin Vallée',
  SESSION_SECRET: 'x'.repeat(32),
  SMTP_HOST: 'smtp.test',
  SMTP_PORT: '465',
  SMTP_USER: 'u',
  SMTP_PASS: 'p',
  SMTP_FROM: 'Carte <carte@test.ch>',
};

export function testConfig(over: Partial<Config> = {}): Config {
  return {
    baseUrl: 'https://carte.test',
    port: 3000,
    dataDir: '/tmp/carte-test',
    adminEmail: 'benjamin@test.ch',
    ownerName: 'Benjamin Vallée',
    sessionSecret: 'x'.repeat(32),
    smtp: { host: 'smtp.test', port: 465, user: 'u', pass: 'p', from: 'Carte <carte@test.ch>' },
    folk: { apiKey: null, groupId: null },
    s3: null,
    ...over,
  };
}

import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDb } from '../src/db/index.ts';
import { createApp, type Deps } from '../src/app.ts';
import { ensureBootstrap, saveCard } from '../src/cards/repo.ts';
import type { CardInput } from '../src/cards/types.ts';
import type { MailMessage } from '../src/leads/mailer.ts';

export const NOW = new Date('2026-10-19T08:00:00Z');

export function cardInput(over: Partial<CardInput> = {}): CardInput {
  return {
    slug: 'benjamin-vallee', firstName: 'Benjamin', lastName: 'Vallée', titleLine1: 'Coach professionnel', titleLine2: "d'équipe et d'organisation",
    company: '', phone: '+41 79 123 45 67', email: 'b@test.ch', whatsapp: '+41 79 123 45 67', accentColor: '#1F4E79',
    links: [{ kind: 'linkedin', url: 'https://www.linkedin.com/in/benjamin' }], fields: [{ label: 'Prendre RDV', value: 'https://cal.test/b' }], ...over,
  };
}

export function makeApp(over: Partial<Deps> = {}) {
  const dataDir = mkdtempSync(join(tmpdir(), 'carte-app-'));
  const db = openDb(':memory:');
  const config = testConfig({ dataDir });
  const { userId, cardId } = ensureBootstrap(db, config, NOW);
  saveCard(db, cardId, cardInput(), NOW);
  const sent: MailMessage[] = [];
  let clock = NOW.getTime();
  const deps: Deps = { db, config, now: () => new Date(clock), fetch, mailer: { send: async (m) => { sent.push(m); } }, ...over };
  const app = createApp(deps);
  return { app, db, deps, userId, cardId, sent, dataDir, advance: (ms: number) => { clock += ms; } };
}

export function form(data: Record<string, string>, headers: Record<string, string> = {}): RequestInit {
  return { method: 'POST', body: new URLSearchParams(data), headers };
}

import { createSession } from '../src/auth/repo.ts';

export function adminSession(ctx: ReturnType<typeof makeApp>) {
  const s = createSession(ctx.db, ctx.userId, ctx.deps.now());
  const headers = { cookie: `sid=${s.id}` };
  return {
    csrf: s.csrf,
    get: (path: string) => ctx.app(new Request('https://carte.test' + path, { headers })),
    post: (path: string, data: Record<string, string> | FormData) => {
      const body = data instanceof FormData ? data : new URLSearchParams(data);
      if (body instanceof FormData) { if (!body.has('_csrf')) body.set('_csrf', s.csrf); } else if (!body.has('_csrf')) body.set('_csrf', s.csrf);
      return ctx.app(new Request('https://carte.test' + path, { method: 'POST', body, headers }));
    },
  };
}

import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

export function decodeQr(png: Buffer): string {
  const f = join(mkdtempSync(join(tmpdir(), 'qr-')), 'q.png');
  writeFileSync(f, png);
  return execFileSync('python3', ['-c', 'import cv2,sys;img=cv2.imread(sys.argv[1]);t,_,_=cv2.QRCodeDetector().detectAndDecode(img);print(t,end="")', f]).toString();
}
