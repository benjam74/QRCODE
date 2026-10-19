import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { processPhoto, savePhoto, InvalidImageError, MAX_PHOTO_BYTES } from '../../src/media/photo.ts';

async function jpegWithGps(): Promise<Buffer> {
  return sharp({ create: { width: 800, height: 600, channels: 3, background: '#cc8844' } })
    .jpeg()
    .withExif({ IFD0: { Make: 'TestCam' }, IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '45/1 54/1 0/1' } })
    .toBuffer();
}

test('photo carrée 400x400 sans métadonnées', async () => {
  const src = await jpegWithGps();
  assert.ok((await sharp(src).metadata()).exif, 'la source doit avoir un EXIF');
  const out = await processPhoto(src);
  const m = await sharp(out.square).metadata();
  assert.equal(m.width, 400);
  assert.equal(m.height, 400);
  assert.equal(m.format, 'jpeg');
  assert.equal(m.exif, undefined);
  const og = await sharp(out.og).metadata();
  assert.equal(og.width, 1200);
  assert.equal(og.height, 630);
  assert.equal(og.exif, undefined);
});

test('recadrage explicite accepté', async () => {
  const out = await processPhoto(await jpegWithGps(), { x: 100, y: 50, size: 300 });
  assert.equal((await sharp(out.square).metadata()).width, 400);
});

test('recadrage hors image ramené dans les bornes', async () => {
  const out = await processPhoto(await jpegWithGps(), { x: 700, y: 500, size: 900 });
  assert.equal((await sharp(out.square).metadata()).width, 400);
});

test('PDF refusé', async () => {
  await assert.rejects(processPhoto(Buffer.from('%PDF-1.4\n%âãÏÓ\n1 0 obj\n')), (e: Error) => e instanceof InvalidImageError && e.message === "Ce fichier n'est pas une image lisible (JPEG, PNG ou WebP).");
});

test('fichier tronqué refusé', async () => {
  const src = await jpegWithGps();
  await assert.rejects(processPhoto(src.subarray(0, 200)), InvalidImageError);
});

test('plus de 5 Mo refusé', async () => {
  await assert.rejects(processPhoto(Buffer.alloc(MAX_PHOTO_BYTES + 1)), (e: Error) => e instanceof InvalidImageError && e.message === 'La photo dépasse 5 Mo.');
});

test('savePhoto écrit les deux fichiers', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'carte-'));
  const out = await processPhoto(await jpegWithGps());
  const name = await savePhoto(dir, 7, out, new Date('2026-10-19T08:00:00Z'));
  assert.match(name, /^card-7-\d+\.jpg$/);
  assert.ok(existsSync(join(dir, 'media', name)));
  assert.ok(existsSync(join(dir, 'media', name.replace('.jpg', '-og.jpg'))));
});
