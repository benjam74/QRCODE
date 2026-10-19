import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeApp, NOW } from '../helpers.ts';
import { createEvent } from '../../src/leads/repo.ts';
import { saveCard } from '../../src/cards/repo.ts';
import { cardInput } from '../helpers.ts';

const get = (app: (r: Request) => Promise<Response>, path: string) => app(new Request('https://carte.test' + path));

test('page de la carte : contenu principal', async () => {
  const { app } = makeApp();
  const res = await get(app, '/c/benjamin-vallee');
  assert.equal(res.status, 200);
  const body = await res.text();
  assert.ok(body.includes('Benjamin Vallée'));
  assert.ok(body.includes('Coach professionnel'));
  assert.ok(body.includes('d&#39;équipe et d&#39;organisation'));
  assert.ok(body.includes('href="tel:+41791234567"'));
  assert.ok(body.includes('href="https://wa.me/41791234567"'));
  assert.ok(body.includes('href="mailto:b@test.ch"'));
  assert.ok(body.includes('id="save-contact"'));
  assert.ok(body.includes('href="/c/benjamin-vallee/contact.vcf"'));
  assert.ok(body.includes('id="echange"'));
  assert.ok(body.includes('<meta property="og:title" content="Benjamin Vallée">'));
  assert.ok(body.includes('<meta property="og:url" content="https://carte.test/c/benjamin-vallee">'));
  assert.ok(body.includes('https://cal.test/b'));
  assert.ok(!body.includes('og:image'), 'pas d image OG sans photo');
  assert.ok(body.includes('class="avatar initials"'));
});

test('événement connu : champ caché et scan compté', async () => {
  const { app, db, userId, cardId } = makeApp();
  createEvent(db, userId, cardId, 'Salon RH', null, NOW);
  const body = await (await get(app, '/c/benjamin-vallee?e=salon-rh')).text();
  assert.ok(body.includes('<input type="hidden" name="event" value="salon-rh">'));
  const row = db.prepare('select e.slug, s.count from scans s join events e on e.id = s.event_id').get() as { slug: string; count: number };
  assert.deepEqual({ ...row }, { slug: 'salon-rh', count: 1 });
});

test('événement inconnu : pas de champ caché, scan sans événement', async () => {
  const { app, db } = makeApp();
  const body = await (await get(app, '/c/benjamin-vallee?e=inconnu')).text();
  assert.ok(!body.includes('name="event"'));
  const row = db.prepare('select event_id, count from scans').get() as { event_id: number; count: number };
  assert.deepEqual({ ...row }, { event_id: 0, count: 1 });
});

test('ancien slug : 301 en gardant la query', async () => {
  const { app, db, cardId } = makeApp();
  saveCard(db, cardId, cardInput({ slug: 'nouveau' }), NOW);
  const res = await get(app, '/c/benjamin-vallee?e=salon-rh');
  assert.equal(res.status, 301);
  assert.equal(res.headers.get('location'), '/c/nouveau?e=salon-rh');
  assert.equal(res.headers.get('cache-control'), 'no-store');
  const vcf = await get(app, '/c/benjamin-vallee/contact.vcf');
  assert.equal(vcf.status, 301);
  assert.equal(vcf.headers.get('location'), '/c/nouveau/contact.vcf');
});

test('slug inconnu : 404', async () => {
  const { app } = makeApp();
  assert.equal((await get(app, '/c/inconnu')).status, 404);
});

test('fiche contact téléchargeable', async () => {
  const { app } = makeApp();
  const res = await get(app, '/c/benjamin-vallee/contact.vcf');
  assert.equal(res.status, 200);
  assert.ok(res.headers.get('content-type')?.startsWith('text/vcard'));
  assert.equal(res.headers.get('content-disposition'), 'attachment; filename="benjamin-vallee.vcf"');
  assert.ok((await res.text()).includes('FN:Benjamin Vallée'));
});

test('média : traversée de dossier refusée', async () => {
  const { app } = makeApp();
  assert.equal((await get(app, '/media/..%2Fcarte.db')).status, 404);
  assert.equal((await get(app, '/media/inexistant.jpg')).status, 404);
});

test('aucune réponse publique ne pose de cookie', async () => {
  const { app } = makeApp();
  for (const p of ['/c/benjamin-vallee', '/c/benjamin-vallee/contact.vcf', '/c/inconnu']) {
    assert.equal((await get(app, p)).headers.get('set-cookie'), null, p);
  }
});

test('feuille de style servie', async () => {
  const { app } = makeApp();
  const res = await get(app, '/static/style.css');
  assert.equal(res.status, 200);
  assert.ok(res.headers.get('content-type')?.startsWith('text/css'));
});

test('aperçu de l administration (iframe) : pas de scan compté', async () => {
  const { app, db } = makeApp();
  await app(new Request('https://carte.test/c/benjamin-vallee', { headers: { 'sec-fetch-dest': 'iframe' } }));
  assert.equal(db.prepare('select count(*) n from scans').get()!.n, 0);
});
