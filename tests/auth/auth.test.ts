import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeApp, form } from '../helpers.ts';
import { createSession } from '../../src/auth/repo.ts';

const U = 'https://carte.test';
const ip = { 'x-carte-remote-addr': '10.0.0.1' };

function tokenFrom(text: string): string {
  const m = /\/admin\/login\/verify\?token=([A-Za-z0-9_-]+)/.exec(text);
  assert.ok(m, 'lien absent');
  return m[1];
}

test('page de connexion', async () => {
  const { app } = makeApp();
  const res = await app(new Request(U + '/admin/login'));
  assert.equal(res.status, 200);
  assert.ok((await res.text()).includes('name="email"'));
});

test('adresse admin : e-mail avec lien', async () => {
  const { app, sent } = makeApp();
  const res = await app(new Request(U + '/admin/login', form({ email: 'Benjamin@test.ch' }, ip)));
  assert.ok((await res.text()).includes('Si cette adresse est autorisée, un lien de connexion vient d&#39;être envoyé.'));
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, 'benjamin@test.ch');
  tokenFrom(sent[0].text);
});

test('autre adresse : même message, aucun e-mail', async () => {
  const { app, sent } = makeApp();
  const res = await app(new Request(U + '/admin/login', form({ email: 'pirate@ex.ch' }, ip)));
  assert.ok((await res.text()).includes('Si cette adresse est autorisée, un lien de connexion vient d&#39;être envoyé.'));
  assert.equal(sent.length, 0);
});

test('lien : GET affiche un bouton, POST connecte avec un cookie sûr', async () => {
  const { app, sent } = makeApp();
  await app(new Request(U + '/admin/login', form({ email: 'benjamin@test.ch' }, ip)));
  const token = tokenFrom(sent[0].text);
  const page = await app(new Request(`${U}/admin/login/verify?token=${token}`));
  assert.equal(page.status, 200);
  assert.ok((await page.text()).includes(`value="${token}"`));
  const res = await app(new Request(U + '/admin/login/verify', form({ token })));
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), '/admin');
  const cookie = res.headers.get('set-cookie')!;
  assert.match(cookie, /^sid=[A-Za-z0-9_-]+;/);
  for (const attr of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Max-Age=2592000', 'Path=/']) assert.ok(cookie.includes(attr), attr);
});

test('lien déjà utilisé ou expiré', async () => {
  const { app, sent, advance } = makeApp();
  await app(new Request(U + '/admin/login', form({ email: 'benjamin@test.ch' }, ip)));
  const token = tokenFrom(sent[0].text);
  await app(new Request(U + '/admin/login/verify', form({ token })));
  const again = await app(new Request(U + '/admin/login/verify', form({ token })));
  assert.equal(again.status, 400);
  assert.ok((await again.text()).includes('Ce lien a expiré ou a déjà servi.'));
  await app(new Request(U + '/admin/login', form({ email: 'benjamin@test.ch' }, ip)));
  const t2 = tokenFrom(sent[1].text);
  advance(16 * 60_000);
  const late = await app(new Request(U + '/admin/login/verify', form({ token: t2 })));
  assert.ok((await late.text()).includes('Ce lien a expiré ou a déjà servi.'));
});

test('admin sans session : redirection vers la connexion', async () => {
  const { app } = makeApp();
  const res = await app(new Request(U + '/admin'));
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), '/admin/login');
});

test('session expirée après 30 jours', async () => {
  const { app, db, userId, deps, advance } = makeApp();
  const s = createSession(db, userId, deps.now());
  advance(31 * 24 * 3600_000);
  const res = await app(new Request(U + '/admin', { headers: { cookie: `sid=${s.id}` } }));
  assert.equal(res.headers.get('location'), '/admin/login');
});

test('POST admin sans jeton CSRF : 403, avec : passe', async () => {
  const { app, db, userId, deps } = makeApp();
  const s = createSession(db, userId, deps.now());
  const bad = await app(new Request(U + '/admin/logout', { method: 'POST', body: new URLSearchParams({}), headers: { cookie: `sid=${s.id}` } }));
  assert.equal(bad.status, 403);
  const ok = await app(new Request(U + '/admin/logout', { method: 'POST', body: new URLSearchParams({ _csrf: s.csrf }), headers: { cookie: `sid=${s.id}` } }));
  assert.equal(ok.status, 302);
  assert.match(ok.headers.get('set-cookie') ?? '', /sid=;.*Max-Age=0/);
  assert.equal((db.prepare('select count(*) n from sessions').get() as { n: number }).n, 0);
});

test('6e demande de lien dans l heure : refusée', async () => {
  const { app, sent } = makeApp();
  for (let i = 0; i < 6; i++) await app(new Request(U + '/admin/login', form({ email: 'benjamin@test.ch' }, ip)));
  assert.equal(sent.length, 5);
});

test('un ancien utilisateur qui n est plus ADMIN_EMAIL ne reçoit pas de lien', async () => {
  const { app, db, sent } = makeApp();
  db.prepare("insert into users (email, created_at) values ('ancien@test.ch', 'x')").run();
  await app(new Request(U + '/admin/login', form({ email: 'ancien@test.ch' }, ip)));
  assert.equal(sent.length, 0);
});
