import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toCsv } from '../../src/admin/csv.ts';

test('CSV point-virgule, guillemets doublés, BOM', () => {
  assert.equal(toCsv([['a;b', 'c"d']]), '﻿"a;b";"c""d"\r\n');
});
test('neutralise les formules Excel', () => {
  assert.equal(toCsv([['=HYPERLINK("x")', '+41 79', '-x', '@x']]), "﻿\"'=HYPERLINK(\"\"x\"\")\";\"+41 79\";\"'-x\";\"'@x\"\r\n");
});

test('neutralise une formule qui commence par un signe et un chiffre', () => {
  assert.equal(toCsv([["-2+3+cmd|' /C calc'!A0"]]), "\uFEFF\"'-2+3+cmd|' /C calc'!A0\"\r\n");
  assert.equal(toCsv([['+41 79 123 45 67', '06.12.34']]), '\uFEFF"+41 79 123 45 67";"06.12.34"\r\n');
});
