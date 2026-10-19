import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pushToFolk, folkDescription } from '../../src/leads/folk.ts';
import type { LeadRow } from '../../src/leads/repo.ts';

const lead: LeadRow = {
  id: 1, userId: 1, cardId: 1, eventId: 3, eventName: 'Salon RH', firstName: 'Anne', lastName: 'Martin', email: 'anne@ex.ch',
  phone: '+41 79 000 00 00', company: 'ACME', consentAt: '2026-10-19T08:00:00.000Z', consentVersion: 'v1', createdAt: '2026-10-19T08:00:00.000Z',
  emailStatus: 'pending', folkStatus: 'pending', folkAttempts: 0, folkNextAt: null, folkPersonId: null, lastError: null,
};
const cfg = { apiKey: 'k', groupId: 'g' };

function fakeFetch(status: number, body: unknown, calls: { url: string; init: RequestInit }[]): typeof fetch {
  return (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
}

test('requête Folk exacte', async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const r = await pushToFolk(lead, 'Salon RH', cfg, fakeFetch(200, { data: { id: 'per_1' } }, calls));
  assert.deepEqual(r, { ok: true, personId: 'per_1' });
  assert.equal(calls[0].url, 'https://api.folk.app/v1/people');
  assert.equal(calls[0].init.method, 'POST');
  const h = new Headers(calls[0].init.headers);
  assert.equal(h.get('authorization'), 'Bearer k');
  assert.equal(h.get('content-type'), 'application/json');
  assert.deepEqual(JSON.parse(String(calls[0].init.body)), {
    firstName: 'Anne', lastName: 'Martin', emails: ['anne@ex.ch'], phones: ['+41 79 000 00 00'], companies: [{ name: 'ACME' }],
    groups: [{ id: 'g' }], description: 'Rencontré via carte QR, événement Salon RH, le 19/10/2026',
  });
});

test('description sans événement, date à Paris', () => {
  assert.equal(folkDescription(null, '2026-10-19T23:30:00.000Z'), 'Rencontré via carte QR, le 20/10/2026');
});

test('champs absents non envoyés', async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  await pushToFolk({ ...lead, email: null, company: null }, null, cfg, fakeFetch(200, { data: { id: 'p' } }, calls));
  const body = JSON.parse(String(calls[0].init.body));
  assert.equal(body.emails, undefined);
  assert.equal(body.companies, undefined);
});

test('500 réessayable, 429 réessayable, 400 non', async () => {
  const r500 = await pushToFolk(lead, null, cfg, fakeFetch(500, {}, []));
  assert.equal(r500.ok, false);
  if (!r500.ok) assert.equal(r500.retryable, true);
  const r429 = await pushToFolk(lead, null, cfg, fakeFetch(429, {}, []));
  if (!r429.ok) assert.equal(r429.retryable, true);
  const r400 = await pushToFolk(lead, null, cfg, fakeFetch(400, { error: { message: 'bad' } }, []));
  assert.equal(r400.ok, false);
  if (!r400.ok) { assert.equal(r400.retryable, false); assert.match(r400.error, /400/); }
});

test('erreur réseau réessayable', async () => {
  const f = (async () => { throw new TypeError('fetch failed'); }) as unknown as typeof fetch;
  const r = await pushToFolk(lead, null, cfg, f);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.retryable, true);
});

test('Folk non configuré', async () => {
  assert.deepEqual(await pushToFolk(lead, null, { apiKey: null, groupId: 'g' }, fetch), { ok: false, error: 'Folk non configuré', retryable: false });
});
