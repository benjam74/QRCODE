import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeApp, NOW, testConfig } from '../helpers.ts';
import { createLeadDeduped, getLead } from '../../src/leads/repo.ts';
import { dispatchLead, processDueLeads } from '../../src/leads/dispatcher.ts';
import type { Deps } from '../../src/app.ts';

function setup(status: number | 'throw', mailerFails = false) {
  const calls: string[] = [];
  const f = (async (_u: unknown, init?: RequestInit) => {
    calls.push(String(init?.body));
    if (status === 'throw') throw new TypeError('fetch failed');
    return new Response(JSON.stringify({ data: { id: 'per_9' } }), { status });
  }) as typeof fetch;
  const ctx = makeApp({ fetch: f });
  ctx.deps.config = testConfig({ dataDir: ctx.dataDir, folk: { apiKey: 'k', groupId: 'g' } });
  if (mailerFails) ctx.deps.mailer = { send: async () => { throw new Error('SMTP 535'); } };
  const { id } = createLeadDeduped(ctx.db, ctx.cardId, ctx.userId, null,
    { firstName: 'Anne', lastName: 'Martin', email: 'anne@ex.ch', phone: null, company: null, eventSlug: null }, 'v1', NOW);
  return { ...ctx, id, calls, deps: ctx.deps as Deps };
}

test('succès : e-mail envoyé et Folk ok', async () => {
  const { deps, id, sent, db } = setup(200);
  await dispatchLead(deps, id);
  const l = getLead(db, id)!;
  assert.equal(l.emailStatus, 'sent');
  assert.equal(l.folkStatus, 'sent');
  assert.equal(l.folkPersonId, 'per_9');
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, 'benjamin@test.ch');
  assert.equal(sent[0].subject, 'Nouveau contact : Anne Martin');
  assert.ok(sent[0].text.includes('anne@ex.ch'));
  assert.ok(sent[0].text.includes('https://carte.test/admin/contacts'));
});

test('second appel ne renvoie rien', async () => {
  const { deps, id, sent, calls } = setup(200);
  await dispatchLead(deps, id);
  await dispatchLead(deps, id);
  assert.equal(sent.length, 1);
  assert.equal(calls.length, 1);
});

test('Folk 500 : retry dans 15 min', async () => {
  const { deps, id, db } = setup(500);
  await dispatchLead(deps, id);
  const l = getLead(db, id)!;
  assert.equal(l.folkStatus, 'retry');
  assert.equal(l.folkAttempts, 1);
  assert.equal(l.folkNextAt, new Date(NOW.getTime() + 15 * 60_000).toISOString());
  assert.ok(l.lastError);
});

test('5 échecs : statut error', async () => {
  const { deps, id, db, advance, calls } = setup('throw');
  await dispatchLead(deps, id);
  for (let i = 0; i < 6; i++) { advance(15 * 60_000 + 1000); await processDueLeads(deps); }
  const l = getLead(db, id)!;
  assert.equal(l.folkStatus, 'error');
  assert.equal(l.folkAttempts, 5);
  assert.equal(calls.length, 5);
});

test('pas de nouvel essai avant l échéance', async () => {
  const { deps, id, calls, advance } = setup(500);
  await dispatchLead(deps, id);
  advance(5 * 60_000);
  await processDueLeads(deps);
  assert.equal(calls.length, 1);
});

test('Folk 400 : error immédiat', async () => {
  const { deps, id, db } = setup(400);
  await dispatchLead(deps, id);
  assert.equal(getLead(db, id)!.folkStatus, 'error');
});

test('mailer en échec : email error, Folk quand même tenté', async () => {
  const { deps, id, db, calls } = setup(200, true);
  await dispatchLead(deps, id);
  const l = getLead(db, id)!;
  assert.equal(l.emailStatus, 'error');
  assert.equal(l.folkStatus, 'sent');
  assert.equal(calls.length, 1);
  assert.match(l.lastError ?? '', /SMTP 535/);
});

test('pending ancien de plus de 2 min repris par processDueLeads', async () => {
  const { deps, id, db, advance } = setup(200);
  advance(3 * 60_000);
  assert.equal(await processDueLeads(deps), 1);
  assert.equal(getLead(db, id)!.folkStatus, 'sent');
});
