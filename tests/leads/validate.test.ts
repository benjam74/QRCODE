import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateLead, validateWaitlist } from '../../src/leads/validate.ts';

const ok = { firstName: ' Anne ', lastName: 'Martin', email: 'anne@ex.ch', phone: '', company: '', consent: '1' };

test('valide avec e-mail seul, espaces retirés', () => {
  const r = validateLead(ok);
  assert.ok(r.ok);
  if (r.ok) assert.deepEqual(r.value, { firstName: 'Anne', lastName: 'Martin', email: 'anne@ex.ch', phone: null, company: null, eventSlug: null });
});

test('valide avec téléphone seul et événement', () => {
  const r = validateLead({ ...ok, email: '', phone: '+41 79 000 00 00', event: 'salon-rh' });
  assert.ok(r.ok);
  if (r.ok) { assert.equal(r.value.phone, '+41 79 000 00 00'); assert.equal(r.value.eventSlug, 'salon-rh'); }
});

test('messages d erreur exacts', () => {
  const r = validateLead({ firstName: '', lastName: ' ', email: '', phone: '', consent: '' });
  assert.equal(r.ok, false);
  if (!r.ok) assert.deepEqual(r.errors, {
    firstName: 'Indiquez votre prénom.',
    lastName: 'Indiquez votre nom.',
    contact: 'Indiquez un e-mail ou un téléphone.',
    consent: 'Cochez la case pour envoyer vos coordonnées.',
  });
});

test('e-mail invalide', () => {
  const r = validateLead({ ...ok, email: 'anne@' });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.errors.email, 'Cet e-mail ne semble pas valide.');
});

test('champ piège rempli', () => {
  const r = validateLead({ ...ok, website: 'http://spam' });
  assert.deepEqual(r, { ok: false, errors: { _bot: '1' } });
});

test('longueurs bornées', () => {
  const r = validateLead({ ...ok, firstName: 'a'.repeat(300) });
  assert.equal(r.ok, false);
});

test('liste d attente', () => {
  assert.deepEqual(validateWaitlist({ email: 'X@Ex.ch ', consent: '1' }), { ok: true, value: { email: 'x@ex.ch' } });
  const r = validateWaitlist({ email: 'x', consent: '' });
  assert.equal(r.ok, false);
  if (!r.ok) assert.deepEqual(r.errors, { waitEmail: 'Cet e-mail ne semble pas valide.', waitConsent: 'Cochez la case pour vous inscrire.' });
});
