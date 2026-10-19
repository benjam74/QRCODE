import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb, migrate } from '../src/db/index.ts';

test('openDb crée les 11 tables', () => {
  const db = openDb(':memory:');
  const names = (db.prepare("select name from sqlite_master where type='table' and name != 'schema_migrations' order by name").all() as { name: string }[]).map((r) => r.name);
  assert.deepEqual(names, ['card_fields', 'card_links', 'card_slug_history', 'cards', 'events', 'leads', 'login_tokens', 'scans', 'sessions', 'users', 'waitlist']);
});

test('migrate est idempotent', () => {
  const db = openDb(':memory:');
  migrate(db);
  const n = db.prepare('select count(*) n from schema_migrations').get() as { n: number };
  assert.equal(n.n, 1);
});

test('foreign_keys actif', () => {
  const db = openDb(':memory:');
  const r = db.prepare('pragma foreign_keys').get() as { foreign_keys: number };
  assert.equal(r.foreign_keys, 1);
});
