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

import { phoneForDial } from '../cards/phone.ts';
import type { LeadInput } from './validate.ts';

export type LeadRow = {
  id: number; userId: number; cardId: number; eventId: number | null; eventName: string | null;
  firstName: string; lastName: string; email: string | null; phone: string | null; company: string | null;
  consentAt: string; consentVersion: string; createdAt: string;
  emailStatus: 'pending' | 'sent' | 'error'; folkStatus: 'pending' | 'retry' | 'sent' | 'error';
  folkAttempts: number; folkNextAt: string | null; folkPersonId: string | null; lastError: string | null;
};

const LEAD_SELECT = `SELECT l.*, e.name AS event_name FROM leads l LEFT JOIN events e ON e.id = l.event_id`;

export function toLead(r: Record<string, unknown>): LeadRow {
  return {
    id: r.id as number, userId: r.user_id as number, cardId: r.card_id as number, eventId: (r.event_id as number) ?? null,
    eventName: (r.event_name as string) ?? null, firstName: r.first_name as string, lastName: r.last_name as string,
    email: (r.email as string) ?? null, phone: (r.phone as string) ?? null, company: (r.company as string) ?? null,
    consentAt: r.consent_at as string, consentVersion: r.consent_version as string, createdAt: r.created_at as string,
    emailStatus: r.email_status as LeadRow['emailStatus'], folkStatus: r.folk_status as LeadRow['folkStatus'],
    folkAttempts: r.folk_attempts as number, folkNextAt: (r.folk_next_at as string) ?? null,
    folkPersonId: (r.folk_person_id as string) ?? null, lastError: (r.last_error as string) ?? null,
  };
}

export function getLead(db: Database, id: number): LeadRow | null {
  const r = db.prepare(`${LEAD_SELECT} WHERE l.id = ?`).get(id) as Record<string, unknown> | undefined;
  return r ? toLead(r) : null;
}

export const DEDUPE_WINDOW_MS = 10 * 60_000;

export function createLeadDeduped(
  db: Database, cardId: number, userId: number, eventId: number | null, input: LeadInput, consentVersion: string, now: Date,
): { id: number; duplicate: boolean } {
  const since = new Date(now.getTime() - DEDUPE_WINDOW_MS).toISOString();
  const recent = db.prepare('SELECT id, email, phone FROM leads WHERE card_id = ? AND created_at >= ?').all(cardId, since) as { id: number; email: string | null; phone: string | null }[];
  const tel = input.phone ? phoneForDial(input.phone) : null;
  const dup = recent.find((r) => (input.email && r.email === input.email) || (tel && r.phone && phoneForDial(r.phone) === tel));
  if (dup) return { id: dup.id, duplicate: true };
  const iso = now.toISOString();
  const id = Number(
    db.prepare(
      `INSERT INTO leads (user_id, card_id, event_id, first_name, last_name, email, phone, company, consent_at, consent_version, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(userId, cardId, eventId, input.firstName, input.lastName, input.email, input.phone, input.company, iso, consentVersion, iso).lastInsertRowid,
  );
  return { id, duplicate: false };
}

export function addToWaitlist(db: Database, userId: number, email: string, now: Date): void {
  const iso = now.toISOString();
  db.prepare('INSERT OR IGNORE INTO waitlist (user_id, email, consent_at, created_at) VALUES (?, ?, ?, ?)').run(userId, email, iso, iso);
}
