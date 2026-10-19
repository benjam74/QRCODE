import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const OG_BACKGROUND = '#F4F1EC';

export class InvalidImageError extends Error {}

export type Crop = { x: number; y: number; size: number };
export type ProcessedPhoto = { square: Buffer; og: Buffer };

const ACCEPTED = new Set(['jpeg', 'png', 'webp']);

export async function processPhoto(input: Buffer, crop?: Crop): Promise<ProcessedPhoto> {
  if (input.length > MAX_PHOTO_BYTES) throw new InvalidImageError('La photo dépasse 5 Mo.');
  const unreadable = () => new InvalidImageError("Ce fichier n'est pas une image lisible (JPEG, PNG ou WebP).");
  let oriented: Buffer;
  let width: number;
  let height: number;
  try {
    const meta = await sharp(input).metadata();
    if (!meta.format || !ACCEPTED.has(meta.format)) throw unreadable();
    const r = await sharp(input, { failOn: 'truncated' }).rotate().toBuffer({ resolveWithObject: true });
    oriented = r.data;
    width = r.info.width;
    height = r.info.height;
  } catch (e) {
    if (e instanceof InvalidImageError) throw e;
    throw unreadable();
  }
  let region: { left: number; top: number; width: number; height: number };
  if (crop && Number.isFinite(crop.x) && Number.isFinite(crop.y) && Number.isFinite(crop.size) && crop.size > 0) {
    const size = Math.max(1, Math.min(Math.round(crop.size), width, height));
    const left = Math.max(0, Math.min(Math.round(crop.x), width - size));
    const top = Math.max(0, Math.min(Math.round(crop.y), height - size));
    region = { left, top, width: size, height: size };
  } else {
    const size = Math.min(width, height);
    region = { left: Math.floor((width - size) / 2), top: Math.floor((height - size) / 2), width: size, height: size };
  }
  const square = await sharp(oriented).extract(region).resize(400, 400).jpeg({ quality: 80, mozjpeg: true }).toBuffer();
  const ogPhoto = await sharp(oriented).extract(region).resize(470, 470).jpeg({ quality: 85 }).toBuffer();
  const og = await sharp({ create: { width: 1200, height: 630, channels: 3, background: OG_BACKGROUND } })
    .composite([{ input: ogPhoto, left: 80, top: 80 }])
    .jpeg({ quality: 82 })
    .toBuffer();
  return { square, og };
}

export function ogFileName(photoFile: string): string {
  return photoFile.replace(/\.jpg$/, '-og.jpg');
}

export async function savePhoto(dataDir: string, cardId: number, out: ProcessedPhoto, now: Date): Promise<string> {
  const dir = join(dataDir, 'media');
  await mkdir(dir, { recursive: true });
  const name = `card-${cardId}-${now.getTime()}.jpg`;
  await writeFile(join(dir, name), out.square);
  await writeFile(join(dir, ogFileName(name)), out.og);
  return name;
}
