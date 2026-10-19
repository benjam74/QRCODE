import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toCsv } from '../../src/admin/csv.ts';

test('CSV point-virgule, guillemets doublés, BOM', () => {
  assert.equal(toCsv([['a;b', 'c"d']]), '﻿"a;b";"c""d"\r\n');
});
test('neutralise les formules Excel', () => {
  assert.equal(toCsv([['=HYPERLINK("x")', '+41 79', '-x', '@x']]), "﻿\"'=HYPERLINK(\"\"x\"\")\";\"+41 79\";\"'-x\";\"'@x\"\r\n");
});
