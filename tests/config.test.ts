import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../src/config.ts';
import { ENV } from './helpers.ts';

test('loadConfig lit toutes les variables', () => {
  const c = loadConfig({ ...ENV, FOLK_API_KEY: 'k', FOLK_GROUP_ID: 'g' });
  assert.equal(c.baseUrl, 'https://carte.test');
  assert.equal(c.port, 3000);
  assert.equal(c.smtp.port, 465);
  assert.deepEqual(c.folk, { apiKey: 'k', groupId: 'g' });
  assert.equal(c.ownerName, 'Benjamin Vallée');
});

test('loadConfig liste toutes les variables manquantes', () => {
  const env = { ...ENV };
  delete env.ADMIN_EMAIL;
  delete env.BASE_URL;
  assert.throws(() => loadConfig(env), (e: Error) => e.message.includes('ADMIN_EMAIL') && e.message.includes('BASE_URL'));
});

test('Folk absent donne apiKey null', () => {
  assert.equal(loadConfig(ENV).folk.apiKey, null);
});

test('aucune variable S3 donne s3 null', () => {
  assert.equal(loadConfig(ENV).s3, null);
});

test('BASE_URL sans slash final', () => {
  assert.equal(loadConfig({ ...ENV, BASE_URL: 'https://a.test/' }).baseUrl, 'https://a.test');
});
