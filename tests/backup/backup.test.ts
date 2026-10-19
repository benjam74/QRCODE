import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { openDb } from '../../src/db/index.ts';
import { ensureBootstrap } from '../../src/cards/repo.ts';
import { runBackup, type BackupStore } from '../../src/backup/backup.ts';
import { createTarGz } from '../../src/backup/tar.ts';
import { shouldRunBackup } from '../../src/scheduler.ts';
import { testConfig } from '../helpers.ts';

function memStore(initial: string[] = []) {
  const objects = new Map<string, Buffer>(initial.map((k) => [k, Buffer.from('old')]));
  const store: BackupStore = {
    put: async (k, b) => { objects.set(k, b); },
    list: async (p) => [...objects.keys()].filter((k) => k.startsWith(p)),
    delete: async (k) => { objects.delete(k); },
  };
  return { store, objects };
}

test('tar.gz lisible par tar', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tar-'));
  const gz = createTarGz([{ name: 'media/a.jpg', data: Buffer.from('AAA') }, { name: 'media/' + 'b'.repeat(120) + '.jpg', data: Buffer.alloc(1000, 1) }], new Date('2026-10-19T00:00:00Z'));
  writeFileSync(join(dir, 'x.tar.gz'), gz);
  const list = execFileSync('tar', ['-tzf', join(dir, 'x.tar.gz')]).toString().trim().split('\n');
  assert.deepEqual(list, ['media/a.jpg', 'media/' + 'b'.repeat(120) + '.jpg']);
  execFileSync('tar', ['-xzf', join(dir, 'x.tar.gz'), '-C', dir]);
  assert.equal(readFileSync(join(dir, 'media/a.jpg'), 'utf8'), 'AAA');
});

test('sauvegarde : base restaurable, médias archivés, rétention 30 jours', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'bk-'));
  mkdirSync(join(dataDir, 'media'));
  writeFileSync(join(dataDir, 'media', 'card-1-1.jpg'), 'IMG');
  const db = openDb(join(dataDir, 'carte.db'));
  ensureBootstrap(db, testConfig({ dataDir }), new Date());
  const { store, objects } = memStore(['backups/2026-09-18/carte.db', 'backups/2026-09-18/media.tar.gz', 'backups/2026-09-19/carte.db']);
  const r = await runBackup(db, dataDir, store, new Date('2026-10-19T01:00:00Z'));
  assert.equal(r.dbKey, 'backups/2026-10-19/carte.db');
  assert.equal(r.mediaKey, 'backups/2026-10-19/media.tar.gz');
  assert.deepEqual(r.deleted.sort(), ['backups/2026-09-18/carte.db', 'backups/2026-09-18/media.tar.gz']);
  assert.ok(objects.has('backups/2026-09-19/carte.db'));
  const restored = join(dataDir, 'restored.db');
  writeFileSync(restored, objects.get(r.dbKey)!);
  const rdb = new DatabaseSync(restored);
  assert.equal((rdb.prepare('select slug from cards').get() as { slug: string }).slug, 'benjamin-vallee');
  const tgz = join(dataDir, 'm.tar.gz');
  writeFileSync(tgz, objects.get(r.mediaKey)!);
  assert.deepEqual(execFileSync('tar', ['-tzf', tgz]).toString().trim().split('\n'), ['media/card-1-1.jpg']);
});

test('erreur du stockage remontée', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'bk-'));
  const db = openDb(join(dataDir, 'carte.db'));
  const store: BackupStore = { put: async () => { throw new Error('S3 403'); }, list: async () => [], delete: async () => {} };
  await assert.rejects(runBackup(db, dataDir, store, new Date()), /S3 403/);
});

test('déclenchement à 3 h heure de Paris, une fois par jour', () => {
  assert.equal(shouldRunBackup(new Date('2026-10-19T01:05:00Z'), null), '2026-10-19'); // 03:05 à Paris (UTC+2)
  assert.equal(shouldRunBackup(new Date('2026-10-19T01:05:00Z'), '2026-10-19'), null);
  assert.equal(shouldRunBackup(new Date('2026-10-19T02:05:00Z'), null), null); // 04:05
  assert.equal(shouldRunBackup(new Date('2026-12-01T02:10:00Z'), null), '2026-12-01'); // 03:10 en hiver (UTC+1)
});
