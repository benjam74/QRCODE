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
