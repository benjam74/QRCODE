import { LINK_KINDS, type CardInput, type LinkKind } from '../cards/types.ts';
import { slugify } from '../cards/slug.ts';

export type CardFormResult = { ok: true; value: CardInput } | { ok: false; errors: Record<string, string>; values: Record<string, string> };

function rows(fd: Record<string, string>, prefix: string, keys: string[]): Record<string, string>[] {
  const out: Record<number, Record<string, string>> = {};
  for (const [k, v] of Object.entries(fd)) {
    const m = new RegExp(`^${prefix}\\[(\\d+)\\]\\[(\\w+)\\]$`).exec(k);
    if (!m || !keys.includes(m[2])) continue;
    (out[Number(m[1])] ??= {})[m[2]] = v.trim();
  }
  return Object.keys(out).map(Number).sort((a, b) => a - b).map((i) => out[i]);
}

export function parseCardForm(fd: Record<string, string>): CardFormResult {
  const t = (k: string) => (fd[k] ?? '').trim();
  const errors: Record<string, string> = {};
  const slug = slugify(t('slug'));
  if (!t('firstName')) errors.firstName = 'Indiquez votre prénom.';
  if (!t('lastName')) errors.lastName = 'Indiquez votre nom.';
  if (!slug) errors.slug = 'Indiquez une adresse (lettres et chiffres).';
  const accent = t('accentColor');
  if (!/^#[0-9a-fA-F]{6}$/.test(accent)) errors.accentColor = 'Choisissez une couleur au format #RRGGBB.';
  const email = t('email');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Cet e-mail ne semble pas valide.';
  for (const k of ['firstName', 'lastName', 'titleLine1', 'titleLine2', 'company', 'phone', 'whatsapp', 'email']) {
    if (t(k).length > 200) errors[k] = 'Ce champ est trop long.';
  }
  const links = rows(fd, 'links', ['kind', 'url']).filter((l) => l.url);
  links.forEach((l, i) => {
    if (!LINK_KINDS.includes(l.kind as LinkKind)) errors[`link${i}`] = 'Type de lien inconnu.';
    else if (!/^https?:\/\/[^\s]+$/i.test(l.url) || l.url.length > 2000) errors[`link${i}`] = 'Le lien doit commencer par https://';
  });
  const fields = rows(fd, 'fields', ['label', 'value']).filter((f) => f.label || f.value);
  fields.forEach((f, i) => {
    if (!f.label || !f.value) errors[`field${i}`] = 'Indiquez un libellé et une valeur.';
    else if (f.label.length > 60 || f.value.length > 500) errors[`field${i}`] = 'Ce champ est trop long.';
  });
  if (Object.keys(errors).length) return { ok: false, errors, values: fd };
  return {
    ok: true,
    value: {
      slug, firstName: t('firstName'), lastName: t('lastName'), titleLine1: t('titleLine1'), titleLine2: t('titleLine2'),
      company: t('company'), phone: t('phone'), email, whatsapp: t('whatsapp'), accentColor: accent.toUpperCase(),
      links: links.map((l) => ({ kind: l.kind as LinkKind, url: l.url })),
      fields: fields.map((f) => ({ label: f.label, value: f.value })),
    },
  };
}
