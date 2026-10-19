import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeApp, form, NOW } from '../helpers.ts';
import { createEvent } from '../../src/leads/repo.ts';

const BASE = { firstName: 'Anne', lastName: 'Martin', email: 'anne@ex.ch', phone: '', company: 'ACME', consent: '1' };
const post = (app: (r: Request) => Promise<Response>, path: string, data: Record<string, string>, ip = '10.0.0.1') =>
  app(new Request('https://carte.test' + path, form(data, { 'x-carte-remote-addr': ip })));

test('envoi valide : remerciement et contact enregistré avec consentement et événement', async () => {
  const { app, db, userId, cardId } = makeApp();
  const ev = createEvent(db, userId, cardId, 'Salon RH', null, NOW);
  const res = await post(app, '/c/benjamin-vallee/echange', { ...BASE, event: 'salon-rh' });
  assert.equal(res.status, 200);
  assert.ok((await res.text()).includes('Merci, Benjamin a bien reçu vos coordonnées.'));
  const rows = db.prepare('select * from leads').all() as Record<string, unknown>[];
  assert.equal(rows.length, 1);
  assert.equal(rows[0].consent_version, 'v1');
  assert.equal(rows[0].event_id, ev.id);
  assert.equal(rows[0].company, 'ACME');
  assert.equal(rows[0].user_id, userId);
});

test('double envoi : un seul contact', async () => {
  const { app, db } = makeApp();
  assert.equal((await post(app, '/c/benjamin-vallee/echange', BASE)).status, 200);
  assert.equal((await post(app, '/c/benjamin-vallee/echange', { ...BASE, email: 'ANNE@ex.ch ' })).status, 200);
  assert.equal((db.prepare('select count(*) n from leads').get() as { n: number }).n, 1);
});

test('double envoi par téléphone normalisé : un seul contact', async () => {
  const { app, db } = makeApp();
  await post(app, '/c/benjamin-vallee/echange', { ...BASE, email: '', phone: '+41 79 000 00 00' });
  await post(app, '/c/benjamin-vallee/echange', { ...BASE, email: '', phone: '+41.79.000.00.00' });
  assert.equal((db.prepare('select count(*) n from leads').get() as { n: number }).n, 1);
});

test('même personne après 10 minutes : nouveau contact', async () => {
  const { app, db, advance } = makeApp();
  await post(app, '/c/benjamin-vallee/echange', BASE);
  advance(11 * 60_000);
  await post(app, '/c/benjamin-vallee/echange', BASE);
  assert.equal((db.prepare('select count(*) n from leads').get() as { n: number }).n, 2);
});

test('sans consentement : 422 avec message et valeurs conservées', async () => {
  const { app, db } = makeApp();
  const res = await post(app, '/c/benjamin-vallee/echange', { ...BASE, consent: '' });
  assert.equal(res.status, 422);
  const body = await res.text();
  assert.ok(body.includes('Cochez la case pour envoyer vos coordonnées.'));
  assert.ok(body.includes('value="Anne"'));
  assert.equal((db.prepare('select count(*) n from leads').get() as { n: number }).n, 0);
});

test('robot : même réponse, rien en base', async () => {
  const { app, db } = makeApp();
  const res = await post(app, '/c/benjamin-vallee/echange', { ...BASE, website: 'x' });
  assert.equal(res.status, 200);
  assert.ok((await res.text()).includes('Merci'));
  assert.equal((db.prepare('select count(*) n from leads').get() as { n: number }).n, 0);
});

test('21e contact accepté de la même IP dans l heure : 429', async () => {
  const { app } = makeApp();
  for (let i = 0; i < 20; i++) assert.equal((await post(app, '/c/benjamin-vallee/echange', { ...BASE, email: `a${i}@ex.ch` }, '10.0.0.9')).status, 200);
  const res = await post(app, '/c/benjamin-vallee/echange', { ...BASE, email: 'z@ex.ch' }, '10.0.0.9');
  assert.equal(res.status, 429);
  assert.ok((await res.text()).includes("Trop d'envois, réessayez dans une heure."));
});

test('carte inconnue : 404', async () => {
  const { app } = makeApp();
  assert.equal((await post(app, '/c/inconnu/echange', BASE)).status, 404);
});

test('liste d attente : doublon ignoré', async () => {
  const { app, db } = makeApp();
  assert.equal((await post(app, '/c/benjamin-vallee/liste-attente', { email: 'w@ex.ch', consent: '1' })).status, 200);
  assert.equal((await post(app, '/c/benjamin-vallee/liste-attente', { email: 'W@ex.ch', consent: '1' })).status, 200);
  assert.equal((db.prepare('select count(*) n from waitlist').get() as { n: number }).n, 1);
});

test('liste d attente invalide : 422', async () => {
  const { app } = makeApp();
  const res = await post(app, '/c/benjamin-vallee/liste-attente', { email: 'w', consent: '' });
  assert.equal(res.status, 422);
  assert.ok((await res.text()).includes('Cochez la case pour vous inscrire.'));
});

test('page de confidentialité', async () => {
  const { app } = makeApp();
  const res = await app(new Request('https://carte.test/confidentialite'));
  assert.equal(res.status, 200);
  const body = await res.text();
  for (const s of ['Benjamin Vallée', 'benjamin@test.ch', '3 ans', 'Infomaniak', 'Folk', 'effacement']) assert.ok(body.includes(s), s);
});

test('les envois refusés (validation, doublons) ne consomment pas le quota', async () => {
  const { app, db } = makeApp();
  for (let i = 0; i < 25; i++) await post(app, '/c/benjamin-vallee/echange', { ...BASE, consent: '' }, '10.0.0.7');
  for (let i = 0; i < 25; i++) await post(app, '/c/benjamin-vallee/echange', BASE, '10.0.0.7');
  const res = await post(app, '/c/benjamin-vallee/echange', { ...BASE, email: 'neuf@ex.ch' }, '10.0.0.7');
  assert.equal(res.status, 200);
  assert.equal((db.prepare('select count(*) n from leads').get() as { n: number }).n, 2);
});
