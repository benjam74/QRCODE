import { test } from 'node:test';
import assert from 'node:assert/strict';
import { phoneForDial } from '../../src/cards/phone.ts';

test('retire espaces et points, garde le +', () => {
  assert.equal(phoneForDial('+41 79 123.45.67'), '+41791234567');
});
test('retire tirets et parenthèses', () => {
  assert.equal(phoneForDial('06 12-34 (56) 78'), '0612345678');
});
test('vide reste vide', () => {
  assert.equal(phoneForDial('  '), '');
});
