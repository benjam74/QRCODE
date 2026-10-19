import { html, type SafeHtml } from '../../http/html.ts';
import { LINK_KINDS, type CardFull } from '../../cards/types.ts';
import { adminLayout, csrfField } from './layout.ts';

const KIND_LABELS: Record<string, string> = { linkedin: 'LinkedIn', facebook: 'Facebook', instagram: 'Instagram', x: 'X', youtube: 'YouTube', website: 'Site web', other: 'Autre' };

export function cardFormPage(opts: { card: CardFull; csrf: string; baseUrl: string; errors?: Record<string, string>; values?: Record<string, string>; saved?: boolean; photoError?: string }): SafeHtml {
  const { card, csrf } = opts;
  const e = opts.errors ?? {};
  const val = (k: string, fallback: string) => (opts.values ? opts.values[k] ?? '' : fallback);
  const err = (k: string) => (e[k] ? html`<p class="field-error">${e[k]}</p>` : '');
  const links = opts.values
    ? Object.keys(opts.values).filter((k) => /^links\[\d+\]\[url\]$/.test(k)).map((k) => {
        const i = /\d+/.exec(k)![0];
        return { kind: opts.values![`links[${i}][kind]`] ?? 'website', url: opts.values![k] };
      })
    : card.links.map((l) => ({ kind: l.kind as string, url: l.url }));
  const fields = opts.values
    ? Object.keys(opts.values).filter((k) => /^fields\[\d+\]\[label\]$/.test(k)).map((k) => {
        const i = /\d+/.exec(k)![0];
        return { label: opts.values![k], value: opts.values![`fields[${i}][value]`] ?? '' };
      })
    : card.fields;
  const linkRows = [...links, ...Array(3).fill({ kind: 'website', url: '' })];
  const fieldRows = [...fields, ...Array(3).fill({ label: '', value: '' })];
  const input = (name: string, label: string, value: string, attrs: SafeHtml | string = '') =>
    html`<label>${label}<input name="${name}" value="${value}"${attrs}${e[name] ? html` aria-invalid="true"` : ''}></label>${err(name)}`;

  const body = html`
${opts.saved ? html`<p class="flash" role="status">Carte enregistrée.</p>` : ''}
${Object.keys(e).length ? html`<p class="flash flash-error" role="alert">Certains champs sont à corriger.</p>` : ''}
<div class="admin-grid">
  <div>
    <section class="panel">
      <h2>Photo</h2>
      ${card.photoFile ? html`<img class="admin-avatar" src="/media/${card.photoFile}" alt="Photo actuelle" width="120" height="120">` : html`<p class="muted">Pas de photo : vos initiales s'affichent.</p>`}
      ${opts.photoError ? html`<p class="field-error" role="alert">${opts.photoError}</p>` : ''}
      <form method="post" action="/admin/carte/photo" enctype="multipart/form-data" id="photo-form">
        ${csrfField(csrf)}
        <label>Nouvelle photo (JPEG, PNG ou WebP, 5 Mo maximum)<input type="file" name="photo" accept="image/jpeg,image/png,image/webp" required></label>
        <div id="crop" class="crop" hidden><img id="crop-img" alt="Aperçu du recadrage"><div id="crop-box" class="crop-box"></div></div>
        <label id="crop-zoom-label" hidden>Zoom<input type="range" id="crop-zoom" min="30" max="100" value="100"></label>
        <input type="hidden" name="crop_x"><input type="hidden" name="crop_y"><input type="hidden" name="crop_size">
        <p class="field-error" id="photo-size-error" hidden>La photo dépasse 5 Mo.</p>
        <button class="btn btn-primary">Envoyer la photo</button>
      </form>
      ${card.photoFile ? html`<form method="post" action="/admin/carte/photo/supprimer">${csrfField(csrf)}<button class="linklike">Supprimer la photo</button></form>` : ''}
    </section>

    <form method="post" action="/admin/carte" class="panel">
      ${csrfField(csrf)}
      <h2>Identité</h2>
      <div class="row2">${input('firstName', 'Prénom', val('firstName', card.firstName), html` autocomplete="given-name" required`)}${input('lastName', 'Nom', val('lastName', card.lastName), html` autocomplete="family-name" required`)}</div>
      ${input('titleLine1', 'Fonction, ligne 1', val('titleLine1', card.titleLine1))}
      ${input('titleLine2', 'Fonction, ligne 2', val('titleLine2', card.titleLine2))}
      ${input('company', 'Société (facultatif)', val('company', card.company), html` autocomplete="organization"`)}

      <h2>Coordonnées</h2>
      ${input('phone', 'Téléphone', val('phone', card.phone), html` type="tel" autocomplete="tel"`)}
      ${input('whatsapp', 'WhatsApp (numéro, facultatif)', val('whatsapp', card.whatsapp), html` type="tel"`)}
      ${input('email', 'E-mail', val('email', card.email), html` type="email" autocomplete="email"`)}

      <h2>Réseaux</h2>
      ${linkRows.map((l, i) => html`
        <div class="row-link">
          <select name="links[${i}][kind]" aria-label="Type de lien ${i + 1}">${LINK_KINDS.map((k) => html`<option value="${k}"${k === l.kind ? html` selected` : ''}>${KIND_LABELS[k]}</option>`)}</select>
          <input name="links[${i}][url]" value="${l.url}" placeholder="https://" aria-label="Adresse du lien ${i + 1}" type="url">
        </div>${err(`link${i}`)}`)}

      <h2>Champs libres</h2>
      <p class="muted">Site, prise de rendez-vous, adresse… Une valeur qui commence par https:// devient un lien.</p>
      ${fieldRows.map((f, i) => html`
        <div class="row2">
          <input name="fields[${i}][label]" value="${f.label}" placeholder="Libellé" aria-label="Libellé ${i + 1}">
          <input name="fields[${i}][value]" value="${f.value}" placeholder="Valeur" aria-label="Valeur ${i + 1}">
        </div>${err(`field${i}`)}`)}

      <h2>Adresse et apparence</h2>
      <label>Adresse de la carte<span class="prefix-input"><span>${opts.baseUrl}/c/</span><input name="slug" value="${val('slug', card.slug)}" required${e.slug ? html` aria-invalid="true"` : ''}></span></label>
      ${err('slug')}
      <p class="muted">Changer cette adresse garde l'ancienne active : vos QR codes imprimés continueront de fonctionner.</p>
      <label>Couleur d'accent<input type="color" name="accentColor" value="${val('accentColor', card.accentColor)}"></label>
      ${err('accentColor')}
      <button class="btn btn-primary">Enregistrer</button>
    </form>
  </div>
  <aside class="preview" aria-label="Aperçu">
    <p class="muted">Aperçu (enregistrez pour mettre à jour)</p>
    <iframe src="/c/${card.slug}" title="Aperçu de la carte" width="390" height="760" loading="lazy"></iframe>
    <p><a href="/c/${card.slug}" target="_blank" rel="noopener">Ouvrir la carte</a></p>
  </aside>
</div>`;
  return adminLayout({ title: 'Ma carte', current: '/admin/carte', csrf, body, scripts: ['/static/admin.js'] });
}
