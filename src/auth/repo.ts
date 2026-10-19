import { createHash, randomBytes } from 'node:crypto';
import type { Database } from '../db/index.ts';

export const LOGIN_TOKEN_TTL_MS = 15 * 60_000;
export const SESSION_TTL_MS = 30 * 24 * 3600_000;

const hash = (s: string) => createHash('sha256').update(s).digest('hex');
const token = () => randomBytes(32).toString('base64url');

export function findUserByEmail(db: Database, email: string): number | null {
  const r = db.prepare('SELECT id FROM users WHERE email = ?').get(email.trim().toLowerCase()) as { id: number } | undefined;
  return r?.id ?? null;
}

export function createLoginToken(db: Database, userId: number, now: Date): string {
  const t = token();
  db.prepare('DELETE FROM login_tokens WHERE expires_at < ?').run(now.toISOString());
  db.prepare('INSERT INTO login_tokens (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(hash(t), userId, new Date(now.getTime() + LOGIN_TOKEN_TTL_MS).toISOString());
  return t;
}

export function consumeLoginToken(db: Database, t: string, now: Date): number | null {
  const r = db.prepare('UPDATE login_tokens SET used_at = ? WHERE token_hash = ? AND used_at IS NULL AND expires_at > ? RETURNING user_id')
    .get(now.toISOString(), hash(t), now.toISOString()) as { user_id: number } | undefined;
  return r?.user_id ?? null;
}

export function createSession(db: Database, userId: number, now: Date): { id: string; csrf: string } {
  const id = token();
  const csrf = token();
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now.toISOString());
  db.prepare('INSERT INTO sessions (id_hash, user_id, expires_at, csrf) VALUES (?, ?, ?, ?)').run(hash(id), userId, new Date(now.getTime() + SESSION_TTL_MS).toISOString(), csrf);
  return { id, csrf };
}

export function getSession(db: Database, id: string, now: Date): { userId: number; csrf: string } | null {
  const r = db.prepare('SELECT user_id, csrf FROM sessions WHERE id_hash = ? AND expires_at > ?').get(hash(id), now.toISOString()) as { user_id: number; csrf: string } | undefined;
  return r ? { userId: r.user_id, csrf: r.csrf } : null;
}

export function deleteSession(db: Database, id: string): void {
  db.prepare('DELETE FROM sessions WHERE id_hash = ?').run(hash(id));
}
