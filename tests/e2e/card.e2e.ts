import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Server } from 'node:http';
import { chromium, type Browser } from 'playwright';
import { openDb } from '../../src/db/index.ts';
import { createApp } from '../../src/app.ts';
import { serve } from '../../src/http/serve.ts';
import { ensureBootstrap, saveCard } from '../../src/cards/repo.ts';
import { testConfig, cardInput } from '../helpers.ts';

let server: Server;
let browser: Browser;
let base = '';

before(async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'e2e-'));
  const db = openDb(join(dataDir, 'carte.db'));
  const port = 4100 + Math.floor(Math.random() * 500);
  base = `http://127.0.0.1:${port}`;
  const config = testConfig({ dataDir, baseUrl: base });
  const { cardId } = ensureBootstrap(db, config, new Date());
  saveCard(db, cardId, cardInput({ titleLine1: 'Coach professionnel', titleLine2: "d'équipe et d'organisation, avec une très longue fonction qui doit passer à la ligne" }), new Date());
  server = serve(createApp({ db, config, now: () => new Date(), fetch, mailer: { send: async () => {} } }), port, base);
  browser = await chromium.launch();
});

after(async () => {
  await browser?.close();
  server?.close();
});

test('mobile 390 px : aucun débordement horizontal', async () => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`${base}/c/benjamin-vallee`);
  assert.ok((await page.evaluate(() => document.documentElement.scrollWidth)) <= 390);
  await page.close();
});

test('après Enregistrer le contact, l échange est mis en avant', async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const page = await ctx.newPage();
  await page.goto(`${base}/c/benjamin-vallee`);
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#save-contact')]);
  assert.equal(download.suggestedFilename(), 'benjamin-vallee.vcf');
  await page.waitForSelector('#echange.highlight', { timeout: 4000 });
  await ctx.close();
});

test('sans JavaScript, le formulaire s envoie', async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto(`${base}/c/benjamin-vallee`);
  await page.fill('input[name="firstName"]', 'Anne');
  await page.fill('input[name="lastName"]', 'Martin');
  await page.fill('#echange input[name="email"]', 'anne@ex.ch');
  await page.check('#echange input[name="consent"]');
  await page.click('#echange button[type="submit"]');
  assert.ok((await page.textContent('body'))?.includes('Merci, Benjamin a bien reçu vos coordonnées.'));
  await ctx.close();
});

test('bouton Choisir ma fiche caché sans l API de sélection', async () => {
  const page = await browser.newPage();
  await page.goto(`${base}/c/benjamin-vallee`);
  assert.equal(await page.isVisible('#pick-contact'), false);
  await page.close();
});
