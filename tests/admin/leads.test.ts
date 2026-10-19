import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeApp, adminSession, NOW } from '../helpers.ts';
import { createEvent, createLeadDeduped, addToWaitlist } from '../../src/leads/repo.ts';

function seed() {
  const ctx = makeApp();
  const ev = createEvent(ctx.db, ctx.userId, ctx.cardId, 'Salon RH', null, NOW);
  const mk = (first: string, eventId: number | null, email: string) =>
    createLeadDeduped(ctx.db, ctx.cardId, ctx.userId, eventId, { firstName: first, lastName: 'X', email, phone: null, company: 'ACME', eventSlug: null }, 'v1', NOW).id;
  const a = mk('Anne', ev.id, 'a@ex.ch');
  const b = mk('Bruno', null, 'b@ex.ch');
  ctx.db.prepare("update leads set folk_status = 'error', last_error = 'Folk 500 : boom' where id = ?").run(b);
  return { ctx, a, b, ev };
}

test('liste des contacts avec statuts et erreur', async () => {
  const { ctx } = seed();
  const s = adminSession(ctx);
  const body = await (await s.get('/admin/contacts')).text();
  assert.ok(body.includes('Anne'));
  assert.ok(body.includes('Bruno'));
  assert.ok(body.includes('Folk 500 : boom'));
  assert.ok(body.includes('Salon RH'));
});

test('filtre par événement', async () => {
  const { ctx } = seed();
  const s = adminSession(ctx);
  const body = await (await s.get('/admin/contacts?e=salon-rh')).text();
  assert.ok(body.includes('Anne'));
  assert.ok(!body.includes('Bruno'));
});

test('export CSV', async () => {
  const { ctx } = seed();
  const s = adminSession(ctx);
  const res = await s.get('/admin/contacts.csv');
  assert.equal(res.headers.get('content-type'), 'text/csv; charset=utf-8');
  assert.match(res.headers.get('content-disposition') ?? '', /attachment; filename="contacts-\d{4}-\d{2}-\d{2}\.csv"/);
  const text = await res.text();
  const lines = text.replace('﻿', '').trim().split('\r\n');
  assert.equal(lines[0], '"Date";"Prénom";"Nom";"E-mail";"Téléphone";"Société";"Événement";"Folk"');
  assert.equal(lines.length, 3);
});

test('renvoyer vers Folk : statut remis à pending puis traité', async () => {
  const { ctx, b } = seed();
  const s = adminSession(ctx);
  const res = await s.post(`/admin/contacts/${b}/renvoyer`, {});
  assert.equal(res.status, 302);
  await new Promise((r) => setTimeout(r, 20));
  const row = ctx.db.prepare('select folk_status, folk_attempts from leads where id = ?').get(b) as { folk_status: string; folk_attempts: number };
  assert.equal(row.folk_status, 'off');
});

test('supprimer un contact', async () => {
  const { ctx, a } = seed();
  const s = adminSession(ctx);
  assert.equal((await s.post(`/admin/contacts/${a}/supprimer`, {})).status, 302);
  assert.equal((ctx.db.prepare('select count(*) n from leads').get() as { n: number }).n, 1);
});

test('contact d un autre utilisateur : 404', async () => {
  const { ctx } = seed();
  const other = Number(ctx.db.prepare("insert into users (email, created_at) values ('o@ex.ch', 'x')").run().lastInsertRowid);
  const id = Number(ctx.db.prepare("insert into leads (user_id, card_id, first_name, last_name, consent_at, consent_version, created_at) values (?, 99, 'O', 'O', 'x', 'v1', 'x')").run(other).lastInsertRowid);
  const s = adminSession(ctx);
  assert.equal((await s.post(`/admin/contacts/${id}/supprimer`, {})).status, 404);
  assert.equal((await s.post(`/admin/contacts/${id}/renvoyer`, {})).status, 404);
});

test('liste d attente : liste, CSV, suppression', async () => {
  const { ctx } = seed();
  addToWaitlist(ctx.db, ctx.userId, 'w@ex.ch', NOW);
  const s = adminSession(ctx);
  assert.ok((await (await s.get('/admin/liste-attente')).text()).includes('w@ex.ch'));
  assert.ok((await (await s.get('/admin/liste-attente.csv')).text()).includes('w@ex.ch'));
  const id = (ctx.db.prepare('select id from waitlist').get() as { id: number }).id;
  assert.equal((await s.post(`/admin/liste-attente/${id}/supprimer`, {})).status, 302);
  assert.equal((ctx.db.prepare('select count(*) n from waitlist').get() as { n: number }).n, 0);
});

test('statistiques des événements', async () => {
  const { ctx } = seed();
  const s = adminSession(ctx);
  await ctx.app(new Request('https://carte.test/c/benjamin-vallee?e=salon-rh'));
  await ctx.app(new Request('https://carte.test/c/benjamin-vallee?e=salon-rh'));
  const body = await (await s.get('/admin/evenements')).text();
  assert.match(body, /data-scans="2"/);
  assert.match(body, /data-leads="1"/);
});
