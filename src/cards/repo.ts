import { transaction, type Database } from '../db/index.ts';
import type { Config } from '../config.ts';
import { slugify } from './slug.ts';
export { slugify };
import type { Card, CardFull, CardInput, CardLink, CardField } from './types.ts';

export class SlugTakenError extends Error {
  constructor() { super('Cette adresse est déjà utilisée.'); }
}


type CardRow = {
  id: number; user_id: number; slug: string; first_name: string; last_name: string; title_line1: string; title_line2: string;
  company: string; phone: string; email: string; whatsapp: string; accent_color: string; photo_file: string | null; updated_at: string;
};

function toCard(r: CardRow): Card {
  return {
    id: r.id, userId: r.user_id, slug: r.slug, firstName: r.first_name, lastName: r.last_name, titleLine1: r.title_line1,
    titleLine2: r.title_line2, company: r.company, phone: r.phone, email: r.email, whatsapp: r.whatsapp,
    accentColor: r.accent_color, photoFile: r.photo_file, updatedAt: r.updated_at,
  };
}

function hydrate(db: Database, card: Card): CardFull {
  const links = db.prepare('SELECT kind, url FROM card_links WHERE card_id = ? ORDER BY position').all(card.id) as CardLink[];
  const fields = db.prepare('SELECT label, value FROM card_fields WHERE card_id = ? ORDER BY position').all(card.id) as CardField[];
  return { ...card, links: links.map((l) => ({ kind: l.kind, url: l.url })), fields: fields.map((f) => ({ label: f.label, value: f.value })) };
}

export function getCardById(db: Database, id: number): CardFull | null {
  const r = db.prepare('SELECT * FROM cards WHERE id = ?').get(id) as CardRow | undefined;
  return r ? hydrate(db, toCard(r)) : null;
}

export function getCardsForUser(db: Database, userId: number): CardFull[] {
  return (db.prepare('SELECT * FROM cards WHERE user_id = ? ORDER BY id').all(userId) as CardRow[]).map((r) => hydrate(db, toCard(r)));
}

export function getCardBySlug(db: Database, slug: string): { card: CardFull } | { redirectTo: string } | null {
  const r = db.prepare('SELECT * FROM cards WHERE slug = ?').get(slug) as CardRow | undefined;
  if (r) return { card: hydrate(db, toCard(r)) };
  const h = db.prepare('SELECT c.slug FROM card_slug_history h JOIN cards c ON c.id = h.card_id WHERE h.old_slug = ?').get(slug) as { slug: string } | undefined;
  return h ? { redirectTo: h.slug } : null;
}

export function saveCard(db: Database, cardId: number, input: CardInput, now: Date): void {
  transaction(db, () => {
    const current = db.prepare('SELECT slug FROM cards WHERE id = ?').get(cardId) as { slug: string } | undefined;
    if (!current) throw new Error(`Carte ${cardId} introuvable`);
    if (input.slug !== current.slug) {
      const owner = db.prepare('SELECT id FROM cards WHERE slug = ?').get(input.slug) as { id: number } | undefined;
      const hist = db.prepare('SELECT card_id FROM card_slug_history WHERE old_slug = ?').get(input.slug) as { card_id: number } | undefined;
      if (owner || (hist && hist.card_id !== cardId)) throw new SlugTakenError();
      db.prepare('DELETE FROM card_slug_history WHERE old_slug = ?').run(input.slug);
      db.prepare('INSERT OR REPLACE INTO card_slug_history (old_slug, card_id) VALUES (?, ?)').run(current.slug, cardId);
    }
    db.prepare(
      `UPDATE cards SET slug = ?, first_name = ?, last_name = ?, title_line1 = ?, title_line2 = ?, company = ?, phone = ?, email = ?,
       whatsapp = ?, accent_color = ?, updated_at = ? WHERE id = ?`,
    ).run(input.slug, input.firstName, input.lastName, input.titleLine1, input.titleLine2, input.company, input.phone, input.email,
      input.whatsapp, input.accentColor, now.toISOString(), cardId);
    db.prepare('DELETE FROM card_links WHERE card_id = ?').run(cardId);
    db.prepare('DELETE FROM card_fields WHERE card_id = ?').run(cardId);
    const insLink = db.prepare('INSERT INTO card_links (card_id, kind, url, position) VALUES (?, ?, ?, ?)');
    input.links.forEach((l, i) => insLink.run(cardId, l.kind, l.url, i));
    const insField = db.prepare('INSERT INTO card_fields (card_id, label, value, position) VALUES (?, ?, ?, ?)');
    input.fields.forEach((f, i) => insField.run(cardId, f.label, f.value, i));
  });
}

export function setCardPhoto(db: Database, cardId: number, file: string | null, now: Date): void {
  db.prepare('UPDATE cards SET photo_file = ?, updated_at = ? WHERE id = ?').run(file, now.toISOString(), cardId);
}

export function ensureBootstrap(db: Database, config: Config, now: Date): { userId: number; cardId: number } {
  return transaction(db, () => {
    let user = db.prepare('SELECT id FROM users WHERE email = ?').get(config.adminEmail) as { id: number } | undefined;
    const all = db.prepare('SELECT id FROM users').all() as { id: number }[];
    if (!user && all.length === 1) {
      // v1 : un seul compte. Un changement de ADMIN_EMAIL renomme le compte au lieu d'en créer un second.
      db.prepare('UPDATE users SET email = ? WHERE id = ?').run(config.adminEmail, all[0].id);
      user = { id: all[0].id };
    }
    if (!user) {
      const id = Number(db.prepare('INSERT INTO users (email, created_at) VALUES (?, ?)').run(config.adminEmail, now.toISOString()).lastInsertRowid);
      user = { id };
    }
    let card = db.prepare('SELECT id FROM cards WHERE user_id = ? ORDER BY id LIMIT 1').get(user.id) as { id: number } | undefined;
    if (!card) {
      const parts = config.ownerName.trim().split(/\s+/);
      const first = parts[0] ?? '';
      const last = parts.slice(1).join(' ');
      const id = Number(
        db.prepare('INSERT INTO cards (user_id, slug, first_name, last_name, email, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
          .run(user.id, slugify(config.ownerName) || 'carte', first, last, config.adminEmail, now.toISOString()).lastInsertRowid,
      );
      card = { id };
    }
    return { userId: user.id, cardId: card.id };
  });
}
