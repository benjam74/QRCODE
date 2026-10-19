import { readdir, readFile, rm, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Database } from '../db/index.ts';
import { createTarGz } from './tar.ts';

export interface BackupStore {
  put(key: string, body: Buffer): Promise<void>;
  list(prefix: string): Promise<string[]>;
  delete(key: string): Promise<void>;
}

export const RETENTION_DAYS = 30;

export async function runBackup(db: Database, dataDir: string, store: BackupStore, now: Date): Promise<{ dbKey: string; mediaKey: string; deleted: string[] }> {
  const day = now.toISOString().slice(0, 10);
  const tmp = await mkdtemp(join(tmpdir(), 'carte-backup-'));
  try {
    const snapshot = join(tmp, 'carte.db');
    db.prepare('VACUUM INTO ?').run(snapshot);
    const dbKey = `backups/${day}/carte.db`;
    await store.put(dbKey, await readFile(snapshot));

    const mediaDir = join(dataDir, 'media');
    const names = await readdir(mediaDir).catch(() => [] as string[]);
    const files = [];
    for (const n of names.sort()) files.push({ name: `media/${n}`, data: await readFile(join(mediaDir, n)) });
    const mediaKey = `backups/${day}/media.tar.gz`;
    await store.put(mediaKey, createTarGz(files, now));

    const limit = new Date(now.getTime() - RETENTION_DAYS * 86_400_000).toISOString().slice(0, 10);
    const deleted: string[] = [];
    for (const key of await store.list('backups/')) {
      const d = /^backups\/(\d{4}-\d{2}-\d{2})\//.exec(key)?.[1];
      if (d && d < limit) {
        await store.delete(key);
        deleted.push(key);
      }
    }
    return { dbKey, mediaKey, deleted };
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}
