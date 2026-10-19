import type { Database } from '../db/index.ts';
import { slugify } from '../cards/slug.ts';

export type EventRow = { id: number; name: string; slug: string; eventDate: string | null };

export function findEvent(db: Database, cardId: number, eventSlug: string): { id: number; name: string } | null {
  const r = db.prepare('SELECT id, name FROM events WHERE card_id = ? AND slug = ?').get(cardId, eventSlug) as { id: number; name: string } | undefined;
  return r ? { id: r.id, name: r.name } : null;
}

export function recordScan(db: Database, cardId: number, eventId: number | null, day: string): void {
  db.prepare(
    'INSERT INTO scans (card_id, event_id, day, count) VALUES (?, ?, ?, 1) ON CONFLICT (card_id, event_id, day) DO UPDATE SET count = count + 1',
  ).run(cardId, eventId ?? 0, day);
}

export function createEvent(db: Database, userId: number, cardId: number, name: string, date: string | null, now: Date): EventRow {
  const base = slugify(name) || 'evenement';
  let slug = base;
  for (let i = 2; db.prepare('SELECT 1 FROM events WHERE card_id = ? AND slug = ?').get(cardId, slug); i++) slug = `${base}-${i}`;
  const id = Number(
    db.prepare('INSERT INTO events (user_id, card_id, slug, name, event_date, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(userId, cardId, slug, name, date, now.toISOString()).lastInsertRowid,
  );
  return { id, name, slug, eventDate: date };
}
