import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { qrSvg, qrPng, qrMatrix } from '../src/qr.ts';

function decode(png: Buffer): string {
  const f = join(mkdtempSync(join(tmpdir(), 'qr-')), 'q.png');
  writeFileSync(f, png);
  return execFileSync('python3', ['-c', 'import cv2,sys;img=cv2.imread(sys.argv[1]);t,_,_=cv2.QRCodeDetector().detectAndDecode(img);print(t,end="")', f]).toString();
}

const URLS = [
  'https://x.test/c/a',
  'https://carte.benjaminvallee.ch/c/benjamin-vallee?e=salon-rh-annecy-2026',
  'https://carte.benjaminvallee.ch/c/' + 'a'.repeat(120),
  'https://carte.benjaminvallee.ch/c/' + 'b'.repeat(250),
];

for (const url of URLS) {
  test(`QR relu par OpenCV (${url.length} octets)`, async () => {
    assert.equal(decode(await qrPng(url, 512)), url);
  });
}

test('taille de matrice selon la version', () => {
  assert.equal(qrMatrix('https://x.test/c/a').length, 21 + 4 * 1);
});

test('SVG valide', async () => {
  const svg = await qrSvg('https://x.test/c/a');
  assert.ok(svg.startsWith('<svg'));
  assert.equal(decode(await sharp(Buffer.from(svg)).resize(400).png().toBuffer()), 'https://x.test/c/a');
});

test('PNG à la largeur demandée', async () => {
  assert.equal((await sharp(await qrPng('https://x.test/c/a', 512)).metadata()).width, 512);
});

test('texte trop long refusé', () => {
  assert.throws(() => qrMatrix('x'.repeat(1000)));
});
