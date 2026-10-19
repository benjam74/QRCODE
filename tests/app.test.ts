import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.ts';
import { openDb } from '../src/db/index.ts';
import { testConfig } from './helpers.ts';

test('GET /health répond ok', async () => {
  const app = createApp({ db: openDb(':memory:'), config: testConfig(), now: () => new Date(), fetch, mailer: { send: async () => {} } });
  const res = await app(new Request('http://x/health'));
  assert.equal(res.status, 200);
  assert.equal(await res.text(), 'ok');
});

test('route inconnue donne 404', async () => {
  const app = createApp({ db: openDb(':memory:'), config: testConfig(), now: () => new Date(), fetch, mailer: { send: async () => {} } });
  const res = await app(new Request('http://x/nope'));
  assert.equal(res.status, 404);
});

test('en-têtes de sécurité sur toutes les réponses', async () => {
  const app = createApp({ db: openDb(':memory:'), config: testConfig(), now: () => new Date(), fetch, mailer: { send: async () => {} } });
  const res = await app(new Request('http://x/health'));
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(res.headers.get('x-frame-options'), 'SAMEORIGIN');
  assert.equal(res.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
  assert.match(res.headers.get('content-security-policy') ?? '', /default-src 'self'/);
  assert.match(res.headers.get('strict-transport-security') ?? '', /max-age=/);
});
