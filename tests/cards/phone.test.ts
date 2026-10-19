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

test('retire le (0) après un indicatif international', () => {
  assert.equal(phoneForDial('+41 (0)79 123 45 67'), '+41791234567');
  assert.equal(phoneForDial('+33 (0) 6 12 34 56 78'), '+33612345678');
  assert.equal(phoneForDial('(022) 123 45 67'), '0221234567');
});
