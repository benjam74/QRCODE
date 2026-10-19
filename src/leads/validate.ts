export type LeadInput = { firstName: string; lastName: string; email: string | null; phone: string | null; company: string | null; eventSlug: string | null };
type Result<T> = { ok: true; value: T } | { ok: false; errors: Record<string, string> };

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX = 200;

const clean = (v: string | undefined) => (v ?? '').trim();

export function validateLead(form: Record<string, string>): Result<LeadInput> {
  if (clean(form.website)) return { ok: false, errors: { _bot: '1' } };
  const firstName = clean(form.firstName);
  const lastName = clean(form.lastName);
  const email = clean(form.email).toLowerCase();
  const phone = clean(form.phone);
  const company = clean(form.company);
  const event = clean(form.event);
  const errors: Record<string, string> = {};
  if (!firstName) errors.firstName = 'Indiquez votre prénom.';
  if (!lastName) errors.lastName = 'Indiquez votre nom.';
  if (!email && !phone) errors.contact = 'Indiquez un e-mail ou un téléphone.';
  if (email && !EMAIL_RE.test(email)) errors.email = 'Cet e-mail ne semble pas valide.';
  if (phone && !/^[+0-9 ().\-/]{6,30}$/.test(phone)) errors.contact = 'Ce numéro ne semble pas valide.';
  if (form.consent !== '1') errors.consent = 'Cochez la case pour envoyer vos coordonnées.';
  for (const [k, v] of Object.entries({ firstName, lastName, email, company })) if (v.length > MAX) errors[k] = 'Ce champ est trop long.';
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { firstName, lastName, email: email || null, phone: phone || null, company: company || null, eventSlug: event || null } };
}

export function validateWaitlist(form: Record<string, string>): Result<{ email: string }> {
  const email = clean(form.email).toLowerCase();
  const errors: Record<string, string> = {};
  if (!EMAIL_RE.test(email) || email.length > MAX) errors.waitEmail = 'Cet e-mail ne semble pas valide.';
  if (form.consent !== '1') errors.waitConsent = 'Cochez la case pour vous inscrire.';
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { email } };
}
