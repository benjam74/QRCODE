import type { CardFull } from './types.ts';
import { phoneForDial } from './phone.ts';
import { slugify } from './slug.ts';

function esc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

export function foldLine(line: string): string {
  const out: string[] = [];
  let current = '';
  let bytes = 0;
  let limit = 75;
  for (const ch of line) {
    const b = Buffer.byteLength(ch, 'utf8');
    if (bytes + b > limit) {
      out.push(current);
      current = ' ';
      bytes = 1;
      limit = 75;
    }
    current += ch;
    bytes += b;
  }
  out.push(current);
  return out.join('\r\n');
}

const isUrl = (v: string) => /^https?:\/\//i.test(v.trim());
const SOCIAL_KINDS = new Set(['linkedin', 'facebook', 'instagram', 'x', 'youtube']);

export function buildVCard(card: CardFull, photo: Buffer | null): string {
  const lines: string[] = ['BEGIN:VCARD', 'VERSION:3.0'];
  lines.push(`N:${esc(card.lastName)};${esc(card.firstName)};;;`);
  lines.push(`FN:${esc(`${card.firstName} ${card.lastName}`.trim())}`);
  const title = [card.titleLine1, card.titleLine2].map((s) => s.trim()).filter(Boolean).join(', ');
  if (title) lines.push(`TITLE:${esc(title)}`);
  if (card.company.trim()) lines.push(`ORG:${esc(card.company.trim())}`);
  const tel = phoneForDial(card.phone);
  if (tel) lines.push(`TEL;TYPE=CELL:${tel}`);
  if (card.email.trim()) lines.push(`EMAIL;TYPE=WORK:${esc(card.email.trim())}`);
  for (const l of card.links) {
    if (SOCIAL_KINDS.has(l.kind)) lines.push(`X-SOCIALPROFILE;TYPE=${l.kind}:${l.url}`);
    lines.push(`URL:${l.url}`);
  }
  const notes: string[] = [];
  for (const f of card.fields) {
    if (isUrl(f.value)) lines.push(`URL:${f.value.trim()}`);
    else notes.push(`${f.label} : ${f.value}`);
  }
  if (notes.length) lines.push(`NOTE:${esc(notes.join('\n'))}`);
  if (photo) lines.push(`PHOTO;ENCODING=b;TYPE=JPEG:${photo.toString('base64')}`);
  lines.push('END:VCARD');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}

export function vcardFilename(card: CardFull): string {
  return (slugify(`${card.firstName} ${card.lastName}`) || 'contact') + '.vcf';
}
