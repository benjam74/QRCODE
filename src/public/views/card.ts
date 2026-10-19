import { html, type SafeHtml } from '../../http/html.ts';
import type { CardFull, LinkKind } from '../../cards/types.ts';
import { phoneForDial } from '../../cards/phone.ts';
import { ogFileName } from '../../media/photo.ts';
import { layout } from './layout.ts';
import { icons } from './icons.ts';

export const CONSENT_VERSION = 'v1';
export function consentText(ownerName: string): string {
  return `J'accepte que ${ownerName} conserve ces coordonnées pour me recontacter dans un cadre professionnel.`;
}

const LINK_LABELS: Record<LinkKind, string> = {
  linkedin: 'LinkedIn', facebook: 'Facebook', instagram: 'Instagram', x: 'X', youtube: 'YouTube', website: 'Site web', other: 'Lien',
};

export type FormState = { values: Record<string, string>; errors: Record<string, string> };

const isUrl = (v: string) => /^https?:\/\//i.test(v.trim());

function initials(card: CardFull): string {
  return ((card.firstName[0] ?? '') + (card.lastName[0] ?? '')).toUpperCase();
}

function fieldError(state: FormState | undefined, name: string): SafeHtml | string {
  const e = state?.errors[name];
  return e ? html`<p class="field-error" id="err-${name}">${e}</p>` : '';
}

function describedBy(state: FormState | undefined, name: string): SafeHtml | string {
  return state?.errors[name] ? html` aria-invalid="true" aria-describedby="err-${name}"` : '';
}

export function renderCardPage(opts: {
  card: CardFull;
  baseUrl: string;
  ownerName: string;
  eventSlug: string | null;
  exchange?: FormState;
  waitlist?: FormState;
}): SafeHtml {
  const { card, baseUrl, eventSlug } = opts;
  const fullName = `${card.firstName} ${card.lastName}`.trim();
  const titles = [card.titleLine1, card.titleLine2].filter((s) => s.trim());
  const url = `${baseUrl}/c/${card.slug}`;
  const tel = phoneForDial(card.phone);
  const wa = phoneForDial(card.whatsapp).replace(/^\+/, '');
  const v = opts.exchange?.values ?? {};
  const head = html`
<meta name="description" content="${titles.join(', ')}">
<meta property="og:type" content="profile">
<meta property="og:title" content="${fullName}">
<meta property="og:description" content="${titles.join(', ')}">
<meta property="og:url" content="${url}">
${card.photoFile ? html`<meta property="og:image" content="${baseUrl}/media/${ogFileName(card.photoFile)}">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">` : ''}
<meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="${url}">`;

  const body = html`
<main class="card">
  <header class="card-head">
    ${card.photoFile
      ? html`<img class="avatar" src="/media/${card.photoFile}" alt="Photo de ${fullName}" width="160" height="160" fetchpriority="high">`
      : html`<div class="avatar initials" aria-hidden="true">${initials(card)}</div>`}
    <h1>${fullName}</h1>
    ${titles.map((t) => html`<p class="title">${t}</p>`)}
    ${card.company.trim() ? html`<p class="company">${card.company}</p>` : ''}
  </header>

  <a id="save-contact" class="btn btn-primary" href="/c/${card.slug}/contact.vcf" download>${icons.download}<span>Enregistrer le contact</span></a>

  <nav class="actions" aria-label="Me contacter">
    ${tel ? html`<a class="action" href="tel:${tel}">${icons.phone}<span>Appeler</span></a>` : ''}
    ${card.email.trim() ? html`<a class="action" href="mailto:${card.email.trim()}">${icons.mail}<span>E-mail</span></a>` : ''}
    ${wa ? html`<a class="action" href="https://wa.me/${wa}">${icons.chat}<span>WhatsApp</span></a>` : ''}
  </nav>

  ${card.links.length
    ? html`<ul class="links">${card.links.map((l) => html`<li><a href="${l.url}" rel="me noopener" target="_blank">${icons.link}<span>${LINK_LABELS[l.kind]}</span></a></li>`)}</ul>`
    : ''}

  ${card.fields.length
    ? html`<dl class="fields">${card.fields.map((f) => html`<div><dt>${f.label}</dt><dd>${isUrl(f.value) ? html`<a href="${f.value.trim()}" rel="noopener" target="_blank">${f.value.trim().replace(/^https?:\/\//, '')}</a>` : f.value}</dd></div>`)}</dl>`
    : ''}

  <section id="echange" class="exchange" aria-labelledby="echange-title">
    <h2 id="echange-title">Échangeons nos coordonnées</h2>
    <p class="hint">Laissez-moi les vôtres, je vous recontacte.</p>
    <form method="post" action="/c/${card.slug}/echange#echange" novalidate>
      ${eventSlug ? html`<input type="hidden" name="event" value="${eventSlug}">` : ''}
      <button type="button" class="btn btn-ghost" id="pick-contact" hidden>Choisir ma fiche dans mes contacts</button>
      <div class="row2">
        <label>Prénom<input name="firstName" autocomplete="given-name" required value="${v.firstName ?? ''}"${describedBy(opts.exchange, 'firstName')}></label>
        <label>Nom<input name="lastName" autocomplete="family-name" required value="${v.lastName ?? ''}"${describedBy(opts.exchange, 'lastName')}></label>
      </div>
      ${fieldError(opts.exchange, 'firstName')}${fieldError(opts.exchange, 'lastName')}
      <label>E-mail<input type="email" name="email" autocomplete="email" inputmode="email" value="${v.email ?? ''}"${describedBy(opts.exchange, 'email')}></label>
      ${fieldError(opts.exchange, 'email')}
      <label>Téléphone<input type="tel" name="phone" autocomplete="tel" value="${v.phone ?? ''}"${describedBy(opts.exchange, 'contact')}></label>
      ${fieldError(opts.exchange, 'contact')}
      <label><span>Société <span class="optional">(facultatif)</span></span><input name="company" autocomplete="organization" value="${v.company ?? ''}"></label>
      <div class="hp" aria-hidden="true"><label>Site web<input name="website" tabindex="-1" autocomplete="off"></label></div>
      <label class="consent"><input type="checkbox" name="consent" value="1"${v.consent ? html` checked` : ''}${describedBy(opts.exchange, 'consent')}><span>${consentText(opts.ownerName)} <a href="/confidentialite">Confidentialité</a></span></label>
      ${fieldError(opts.exchange, 'consent')}
      ${opts.exchange?.errors._form ? html`<p class="field-error" role="alert">${opts.exchange.errors._form}</p>` : ''}
      <button type="submit" class="btn btn-primary">Envoyer mes coordonnées</button>
    </form>
  </section>

  <footer class="foot">
    <details id="liste-attente"${opts.waitlist ? html` open` : ''}>
      <summary>Créer ma carte gratuite</summary>
      <p>Le service ouvre bientôt. Laissez votre e-mail pour être prévenu.</p>
      <form method="post" action="/c/${card.slug}/liste-attente#liste-attente" novalidate>
        <label>E-mail<input type="email" name="email" autocomplete="email" value="${opts.waitlist?.values.email ?? ''}"${describedBy(opts.waitlist, 'waitEmail')}></label>
        ${fieldError(opts.waitlist, 'waitEmail')}
        <label class="consent"><input type="checkbox" name="consent" value="1"><span>J'accepte de recevoir un e-mail à l'ouverture du service. <a href="/confidentialite">Confidentialité</a></span></label>
        ${fieldError(opts.waitlist, 'waitConsent')}
        <button type="submit" class="btn btn-ghost">Me prévenir</button>
      </form>
    </details>
    <p><a href="/confidentialite">Confidentialité</a></p>
  </footer>
</main>`;
  return layout({ title: `${fullName} — carte de visite`, head, body, accent: card.accentColor, scripts: ['/static/card.js'] });
}
