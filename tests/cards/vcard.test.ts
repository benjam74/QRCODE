import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildVCard, vcardFilename } from '../../src/cards/vcard.ts';
import type { CardFull } from '../../src/cards/types.ts';

function card(over: Partial<CardFull> = {}): CardFull {
  return {
    id: 1, userId: 1, slug: 'benjamin-vallee', firstName: 'Benjamin', lastName: 'Vallée', titleLine1: 'Coach professionnel',
    titleLine2: "d'équipe et d'organisation", company: '', phone: '+41 79 123 45 67', email: 'b@test.ch', whatsapp: '',
    accentColor: '#1F4E79', photoFile: null, updatedAt: '', links: [], fields: [], ...over,
  };
}

test('enveloppe vCard 3.0', () => {
  const v = buildVCard(card(), null);
  assert.ok(v.startsWith('BEGIN:VCARD\r\nVERSION:3.0\r\n'));
  assert.ok(v.endsWith('END:VCARD\r\n'));
});

test('nom, fonction, téléphone, e-mail', () => {
  const v = buildVCard(card(), null);
  assert.ok(v.includes('\r\nN:Vallée;Benjamin;;;\r\n'));
  assert.ok(v.includes('\r\nFN:Benjamin Vallée\r\n'));
  assert.ok(v.includes("\r\nTITLE:Coach professionnel\\, d'équipe et d'organisation\r\n"));
  assert.ok(v.includes('\r\nTEL;TYPE=CELL:+41791234567\r\n'));
  assert.ok(v.includes('\r\nEMAIL;TYPE=WORK:b@test.ch\r\n'));
});

test('pas de ligne ORG sans société, ORG avec', () => {
  assert.ok(!buildVCard(card(), null).includes('ORG'));
  assert.ok(buildVCard(card({ company: 'Vallée; Conseil' }), null).includes('\r\nORG:Vallée\; Conseil\r\n'));
});

test('champ libre texte va dans NOTE, échappé', () => {
  const v = buildVCard(card({ fields: [{ label: 'Adresse', value: '1 rue X; Annecy' }, { label: 'Horaires', value: 'lun-ven\nsur RDV' }] }), null);
  assert.ok(v.includes('NOTE:Adresse : 1 rue X\; Annecy\\nHoraires : lun-ven\\nsur RDV'));
});

test('champ libre lien devient URL', () => {
  const v = buildVCard(card({ fields: [{ label: 'Prendre RDV', value: 'https://cal.test/b' }] }), null);
  assert.ok(v.includes('\r\nURL:https://cal.test/b\r\n'));
  assert.ok(!v.includes('NOTE'));
});

test('réseaux : URL et X-SOCIALPROFILE pour linkedin', () => {
  const v = buildVCard(card({ links: [{ kind: 'linkedin', url: 'https://www.linkedin.com/in/benjamin' }, { kind: 'website', url: 'https://b.ch' }] }), null);
  assert.ok(v.includes('\r\nX-SOCIALPROFILE;TYPE=linkedin:https://www.linkedin.com/in/benjamin\r\n'));
  assert.ok(v.includes('\r\nURL:https://b.ch\r\n'));
});

test('photo en base64, lignes repliées à 75 octets', () => {
  const photo = Buffer.alloc(3000, 7);
  const v = buildVCard(card({ titleLine1: 'é'.repeat(80) }), photo);
  assert.ok(v.includes('PHOTO;ENCODING=b;TYPE=JPEG:'));
  for (const line of v.split('\r\n')) assert.ok(Buffer.byteLength(line, 'utf8') <= 75, `ligne trop longue : ${line.length}`);
  const unfolded = v.replace(/\r\n /g, '');
  assert.ok(unfolded.includes('TITLE:' + 'é'.repeat(80)));
  assert.ok(unfolded.includes(photo.toString('base64')));
});

test('nom de fichier', () => {
  assert.equal(vcardFilename(card()), 'benjamin-vallee.vcf');
});
