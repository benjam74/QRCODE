import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { makeApp, adminSession, decodeQr } from '../helpers.ts';
import { signatureHtml } from '../../src/admin/signature.ts';
import { getCardById } from '../../src/cards/repo.ts';

test('signature : URL absolue, pas de script ni de classe', () => {
  const ctx = makeApp();
  const card = getCardById(ctx.db, ctx.cardId)!;
  const h = signatureHtml({ ...card, photoFile: 'p.jpg' }, 'https://carte.test');
  assert.ok(h.includes('href="https://carte.test/c/benjamin-vallee"'));
  assert.ok(h.includes('src="https://carte.test/media/p.jpg"'));
  assert.ok(h.includes('src="https://carte.test/c/benjamin-vallee/qr.png"'));
  assert.ok(h.includes('Ma carte de visite'));
  assert.ok(!h.includes('<script'));
  assert.ok(!h.includes('class='));
});

test('page Partager', async () => {
  const ctx = makeApp();
  const a = adminSession(ctx);
  const body = await (await a.get('/admin/partager')).text();
  assert.ok(body.includes('/admin/qr.png'));
  assert.ok(body.includes('/admin/qr.svg'));
  assert.ok(body.includes('Ma carte de visite'));
});

test('création d événements : slugs uniques', async () => {
  const ctx = makeApp();
  const a = adminSession(ctx);
  assert.equal((await a.post('/admin/evenements', { name: 'Salon RH', date: '2026-11-05' })).status, 302);
  await a.post('/admin/evenements', { name: 'Salon RH', date: '' });
  const slugs = (ctx.db.prepare('select slug from events order by id').all() as { slug: string }[]).map((r) => r.slug);
  assert.deepEqual(slugs, ['salon-rh', 'salon-rh-2']);
  const page = await (await a.get('/admin/evenements')).text();
  assert.ok(page.includes('Salon RH'));
});

test('événement sans nom : 422', async () => {
  const ctx = makeApp();
  const a = adminSession(ctx);
  assert.equal((await a.post('/admin/evenements', { name: ' ' })).status, 422);
});

test('QR PNG d événement : contenu exact', async () => {
  const ctx = makeApp();
  const a = adminSession(ctx);
  await a.post('/admin/evenements', { name: 'Salon RH' });
  const res = await a.get('/admin/qr.png?e=salon-rh');
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'image/png');
  assert.match(res.headers.get('content-disposition') ?? '', /attachment; filename="qr-benjamin-vallee-salon-rh\.png"/);
  const png = Buffer.from(await res.arrayBuffer());
  assert.equal((await sharp(png).metadata()).width, 1024);
  // OpenCV ne détecte pas les QR à très gros modules : on relit une version réduite.
  assert.equal(decodeQr(await sharp(png).resize(500).png().toBuffer()), 'https://carte.test/c/benjamin-vallee?e=salon-rh');
});

test('QR SVG de la carte', async () => {
  const ctx = makeApp();
  const a = adminSession(ctx);
  const res = await a.get('/admin/qr.svg');
  assert.equal(res.headers.get('content-type'), 'image/svg+xml');
  assert.ok((await res.text()).startsWith('<svg'));
});

test('QR d un événement inconnu : 404', async () => {
  const ctx = makeApp();
  const a = adminSession(ctx);
  assert.equal((await a.get('/admin/qr.png?e=nope')).status, 404);
});

test('QR public de la signature', async () => {
  const ctx = makeApp();
  const res = await ctx.app(new Request('https://carte.test/c/benjamin-vallee/qr.png'));
  assert.equal(res.status, 200);
  const png = Buffer.from(await res.arrayBuffer());
  assert.equal((await sharp(png).metadata()).width, 160);
  assert.equal(decodeQr(await sharp(png).resize(480, 480, { kernel: 'nearest' }).png().toBuffer()), 'https://carte.test/c/benjamin-vallee');
});
