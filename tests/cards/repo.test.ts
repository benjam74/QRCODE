import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../../src/db/index.ts';
import { slugify, ensureBootstrap, saveCard, getCardById, getCardBySlug, SlugTakenError, setCardPhoto, getCardsForUser } from '../../src/cards/repo.ts';
import type { CardInput } from '../../src/cards/types.ts';
import { testConfig } from '../helpers.ts';

const NOW = new Date('2026-10-19T08:00:00Z');

function input(over: Partial<CardInput> = {}): CardInput {
  return {
    slug: 'benjamin-vallee', firstName: 'Benjamin', lastName: 'Vallée', titleLine1: 'Coach professionnel', titleLine2: "d'équipe et d'organisation",
    company: '', phone: '+41 79 123 45 67', email: 'b@test.ch', whatsapp: '', accentColor: '#1F4E79', links: [], fields: [], ...over,
  };
}

test('slugify retire accents et espaces', () => {
  assert.equal(slugify('Benjamin Vallée'), 'benjamin-vallee');
  assert.equal(slugify('  Salon RH — Annecy 2026 '), 'salon-rh-annecy-2026');
});

test('ensureBootstrap est idempotent', () => {
  const db = openDb(':memory:');
  const a = ensureBootstrap(db, testConfig(), NOW);
  const b = ensureBootstrap(db, testConfig(), NOW);
  assert.deepEqual(a, b);
  assert.equal((db.prepare('select count(*) n from users').get() as { n: number }).n, 1);
  assert.equal((db.prepare('select count(*) n from cards').get() as { n: number }).n, 1);
  assert.equal(getCardById(db, a.cardId)?.slug, 'benjamin-vallee');
});

test('saveCard remplace les liens et les champs', () => {
  const db = openDb(':memory:');
  const { cardId } = ensureBootstrap(db, testConfig(), NOW);
  saveCard(db, cardId, input({ links: [{ kind: 'linkedin', url: 'https://linkedin.com/in/b' }, { kind: 'website', url: 'https://b.ch' }], fields: [{ label: 'Adresse', value: 'Annecy' }] }), NOW);
  saveCard(db, cardId, input({ links: [{ kind: 'website', url: 'https://b.ch' }] }), NOW);
  const c = getCardById(db, cardId)!;
  assert.deepEqual(c.links, [{ kind: 'website', url: 'https://b.ch' }]);
  assert.deepEqual(c.fields, []);
  assert.equal(c.titleLine2, "d'équipe et d'organisation");
});

test('changer de slug garde l ancien en redirection', () => {
  const db = openDb(':memory:');
  const { cardId } = ensureBootstrap(db, testConfig(), NOW);
  saveCard(db, cardId, input({ slug: 'a' }), NOW);
  saveCard(db, cardId, input({ slug: 'b' }), NOW);
  assert.deepEqual(getCardBySlug(db, 'a'), { redirectTo: 'b' });
  assert.equal((getCardBySlug(db, 'b') as { card: { slug: string } }).card.slug, 'b');
  assert.deepEqual(getCardBySlug(db, 'benjamin-vallee'), { redirectTo: 'b' });
  assert.equal(getCardBySlug(db, 'inconnu'), null);
});

test('revenir à un ancien slug fonctionne', () => {
  const db = openDb(':memory:');
  const { cardId } = ensureBootstrap(db, testConfig(), NOW);
  saveCard(db, cardId, input({ slug: 'a' }), NOW);
  saveCard(db, cardId, input({ slug: 'b' }), NOW);
  saveCard(db, cardId, input({ slug: 'a' }), NOW);
  assert.equal((getCardBySlug(db, 'a') as { card: { slug: string } }).card.slug, 'a');
  assert.deepEqual(getCardBySlug(db, 'b'), { redirectTo: 'a' });
});

test('slug d une autre carte refusé', () => {
  const db = openDb(':memory:');
  const { cardId, userId } = ensureBootstrap(db, testConfig(), NOW);
  db.prepare("insert into cards (user_id, slug, first_name, last_name, updated_at) values (?, 'autre', 'A', 'B', ?)").run(userId, NOW.toISOString());
  assert.throws(() => saveCard(db, cardId, input({ slug: 'autre' }), NOW), SlugTakenError);
});

test('slug présent dans l historique d une autre carte refusé', () => {
  const db = openDb(':memory:');
  const { cardId, userId } = ensureBootstrap(db, testConfig(), NOW);
  const other = Number(db.prepare("insert into cards (user_id, slug, first_name, last_name, updated_at) values (?, 'autre', 'A', 'B', ?)").run(userId, NOW.toISOString()).lastInsertRowid);
  db.prepare("insert into card_slug_history (old_slug, card_id) values ('vieux', ?)").run(other);
  assert.throws(() => saveCard(db, cardId, input({ slug: 'vieux' }), NOW), SlugTakenError);
});

test('setCardPhoto et getCardsForUser', () => {
  const db = openDb(':memory:');
  const { cardId, userId } = ensureBootstrap(db, testConfig(), NOW);
  setCardPhoto(db, cardId, 'card-1-x.jpg', NOW);
  assert.equal(getCardsForUser(db, userId)[0].photoFile, 'card-1-x.jpg');
  setCardPhoto(db, cardId, null, NOW);
  assert.equal(getCardById(db, cardId)?.photoFile, null);
});
