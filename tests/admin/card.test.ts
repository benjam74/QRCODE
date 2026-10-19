import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { makeApp, adminSession } from '../helpers.ts';
import { getCardById } from '../../src/cards/repo.ts';

const FULL = {
  slug: 'benjamin-vallee', firstName: 'Benjamin', lastName: 'Vallée', titleLine1: 'Coach professionnel', titleLine2: "d'équipe",
  company: 'Vallée Conseil', phone: '+41 79 000 00 00', email: 'b@test.ch', whatsapp: '', accentColor: '#2A6F4E',
  'links[0][kind]': 'linkedin', 'links[0][url]': 'https://linkedin.com/in/b', 'links[1][kind]': 'website', 'links[1][url]': '',
  'fields[0][label]': 'Zone', 'fields[0][value]': 'Annecy', 'fields[1][label]': '', 'fields[1][value]': '',
};

test('page Ma carte affiche le formulaire et l aperçu', async () => {
  const ctx = makeApp();
  const a = adminSession(ctx);
  const res = await a.get('/admin/carte');
  assert.equal(res.status, 200);
  const body = await res.text();
  assert.ok(body.includes('name="firstName"'));
  assert.ok(body.includes(`value="${a.csrf}"`));
  assert.ok(body.includes('<iframe'));
  assert.ok(body.includes('vos QR codes imprimés continueront de fonctionner'));
});

test('enregistrement complet, lignes vides ignorées', async () => {
  const ctx = makeApp();
  const a = adminSession(ctx);
  const res = await a.post('/admin/carte', FULL);
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), '/admin/carte?ok=1');
  const c = getCardById(ctx.db, ctx.cardId)!;
  assert.equal(c.company, 'Vallée Conseil');
  assert.equal(c.accentColor, '#2A6F4E');
  assert.deepEqual(c.links, [{ kind: 'linkedin', url: 'https://linkedin.com/in/b' }]);
  assert.deepEqual(c.fields, [{ label: 'Zone', value: 'Annecy' }]);
});

test('changement de slug : ancienne adresse redirigée', async () => {
  const ctx = makeApp();
  const a = adminSession(ctx);
  await a.post('/admin/carte', { ...FULL, slug: 'Benjamin Coach' });
  assert.equal(getCardById(ctx.db, ctx.cardId)!.slug, 'benjamin-coach');
  const r = await ctx.app(new Request('https://carte.test/c/benjamin-vallee'));
  assert.equal(r.status, 301);
  assert.equal(r.headers.get('location'), '/c/benjamin-coach');
});

test('slug pris : 422', async () => {
  const ctx = makeApp();
  ctx.db.prepare("insert into cards (user_id, slug, first_name, last_name, updated_at) values (?, 'pris', 'A', 'B', 'x')").run(ctx.userId);
  const a = adminSession(ctx);
  const res = await a.post('/admin/carte', { ...FULL, slug: 'pris' });
  assert.equal(res.status, 422);
  assert.ok((await res.text()).includes('Cette adresse est déjà utilisée.'));
});

test('validations : nom obligatoire, lien http, couleur', async () => {
  const ctx = makeApp();
  const a = adminSession(ctx);
  const r1 = await a.post('/admin/carte', { ...FULL, 'links[0][url]': 'linkedin.com/in/b' });
  assert.equal(r1.status, 422);
  assert.ok((await r1.text()).includes('Le lien doit commencer par https://'));
  const r2 = await a.post('/admin/carte', { ...FULL, lastName: '' });
  assert.ok((await r2.text()).includes('Indiquez votre nom.'));
  const r3 = await a.post('/admin/carte', { ...FULL, accentColor: 'red' });
  assert.equal(r3.status, 422);
  const r4 = await a.post('/admin/carte', { ...FULL, 'links[0][kind]': 'myspace' });
  assert.equal(r4.status, 422);
});

test('envoi de photo JPEG', async () => {
  const ctx = makeApp();
  const a = adminSession(ctx);
  const jpg = await sharp({ create: { width: 600, height: 400, channels: 3, background: '#888' } }).jpeg().toBuffer();
  const fd = new FormData();
  fd.set('photo', new File([jpg], 'moi.jpg', { type: 'image/jpeg' }));
  fd.set('crop_x', '100'); fd.set('crop_y', '0'); fd.set('crop_size', '400');
  const res = await a.post('/admin/carte/photo', fd);
  assert.equal(res.status, 302);
  const c = getCardById(ctx.db, ctx.cardId)!;
  assert.ok(c.photoFile);
  assert.ok(existsSync(join(ctx.dataDir, 'media', c.photoFile!)));
  const page = await (await ctx.app(new Request('https://carte.test/c/benjamin-vallee'))).text();
  assert.ok(page.includes(`/media/${c.photoFile!.replace('.jpg', '-og.jpg')}`));
});

test('envoi d un PDF : 422 et photo inchangée', async () => {
  const ctx = makeApp();
  const a = adminSession(ctx);
  const fd = new FormData();
  fd.set('photo', new File([Buffer.from('%PDF-1.4 ...')], 'cv.pdf', { type: 'application/pdf' }));
  const res = await a.post('/admin/carte/photo', fd);
  assert.equal(res.status, 422);
  assert.ok((await res.text()).includes('Ce fichier n&#39;est pas une image lisible (JPEG, PNG ou WebP).'));
  assert.equal(getCardById(ctx.db, ctx.cardId)!.photoFile, null);
});

test('aucun fichier : 422', async () => {
  const ctx = makeApp();
  const a = adminSession(ctx);
  const res = await a.post('/admin/carte/photo', new FormData());
  assert.equal(res.status, 422);
});

test('suppression de la photo', async () => {
  const ctx = makeApp();
  ctx.db.prepare("update cards set photo_file = 'x.jpg' where id = ?").run(ctx.cardId);
  const a = adminSession(ctx);
  const res = await a.post('/admin/carte/photo/supprimer', {});
  assert.equal(res.status, 302);
  assert.equal(getCardById(ctx.db, ctx.cardId)!.photoFile, null);
});
