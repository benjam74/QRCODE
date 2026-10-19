import { html, raw, type SafeHtml } from '../../http/html.ts';
import type { CardFull } from '../../cards/types.ts';
import type { LeadRow, WaitlistRow } from '../../leads/repo.ts';
import { adminLayout, csrfField } from './layout.ts';

const frDate = (iso: string) => new Date(iso).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'short', timeStyle: 'short' });

export function sharePage(opts: { card: CardFull; csrf: string; baseUrl: string; signature: string }): SafeHtml {
  const url = `${opts.baseUrl}/c/${opts.card.slug}`;
  return adminLayout({ title: 'Partager', current: '/admin/partager', csrf: opts.csrf, body: html`
<section class="panel">
  <h2>QR code de la carte</h2>
  <p class="muted">Il pointe vers <a href="${url}">${url}</a>. Pour suivre un salon ou un rendez-vous précis, créez plutôt un QR code d'événement.</p>
  <div class="qr-preview"><img src="/admin/qr.png?inline=1" alt="QR code de la carte" width="200" height="200"></div>
  <div class="toolbar">
    <a class="btn btn-primary" href="/admin/qr.png">Télécharger en PNG (écran, impression)</a>
    <a class="btn btn-ghost" href="/admin/qr.svg">Télécharger en SVG (imprimeur)</a>
  </div>
</section>
<section class="panel">
  <h2>Signature d'e-mail</h2>
  <p class="muted">Le lien « Ma carte de visite » est l'élément utile : la personne qui lit votre e-mail sur son téléphone ne peut pas scanner son propre écran. Copiez le bloc ci-dessous et collez-le dans les réglages de signature de votre messagerie.</p>
  <div class="signature-box" id="signature">${raw(opts.signature)}</div>
  <button type="button" class="btn btn-ghost" id="copy-signature" data-target="signature" hidden>Copier la signature</button>
  <details><summary>Code HTML</summary><textarea class="code" readonly>${opts.signature}</textarea></details>
</section>`, scripts: ['/static/admin.js'] });
}

export function eventsPage(opts: { csrf: string; stats: { name: string; slug: string; eventDate: string | null; scans: number; leads: number }[]; totalScans: number; error?: string }): SafeHtml {
  return adminLayout({ title: 'Événements', current: '/admin/evenements', csrf: opts.csrf, body: html`
<form method="post" action="/admin/evenements" class="panel">
  ${csrfField(opts.csrf)}
  <h2>Nouvel événement</h2>
  <div class="row2">
    <label>Nom<input name="name" required placeholder="Salon RH Annecy"${opts.error ? html` aria-invalid="true"` : ''}></label>
    <label>Date (facultatif)<input type="date" name="date"></label>
  </div>
  ${opts.error ? html`<p class="field-error">${opts.error}</p>` : ''}
  <button class="btn btn-primary">Créer l'événement et son QR code</button>
</form>
<p class="muted">Total des ouvertures de la carte : ${opts.totalScans}</p>
${opts.stats.length ? html`<div class="table-wrap"><table class="list"><thead><tr><th>Événement</th><th>Date</th><th>Ouvertures</th><th>Contacts</th><th>QR code</th></tr></thead><tbody>
${opts.stats.map((s) => html`<tr><td>${s.name}</td><td>${s.eventDate ?? ''}</td><td data-scans="${s.scans}">${s.scans}</td><td data-leads="${s.leads}"><a href="/admin/contacts?e=${s.slug}">${s.leads}</a></td>
<td><a href="/admin/qr.png?e=${s.slug}">PNG</a> · <a href="/admin/qr.svg?e=${s.slug}">SVG</a></td></tr>`)}
</tbody></table></div>` : html`<p class="muted">Aucun événement pour l'instant.</p>`}` });
}

function status(kind: 'email' | 'folk', s: string): SafeHtml {
  const map: Record<string, [string, string]> = {
    sent: ['ok', kind === 'email' ? 'E-mail envoyé' : 'Dans Folk'], pending: ['wait', 'En attente'], retry: ['wait', 'Nouvel essai prévu'],
    error: ['ko', 'Erreur'], off: ['', 'Folk non configuré'],
  };
  const [cls, label] = map[s] ?? ['', s];
  return html`<span class="badge ${cls}">${label}</span>`;
}

export function leadsPage(opts: { csrf: string; leads: LeadRow[]; events: { slug: string; name: string }[]; current: string | null }): SafeHtml {
  const q = opts.current ? `?e=${encodeURIComponent(opts.current)}` : '';
  return adminLayout({ title: 'Contacts reçus', current: '/admin/contacts', csrf: opts.csrf, body: html`
<form method="get" action="/admin/contacts" class="toolbar">
  <label>Événement<select name="e"><option value="">Tous</option>${opts.events.map((e) => html`<option value="${e.slug}"${e.slug === opts.current ? html` selected` : ''}>${e.name}</option>`)}</select></label>
  <button class="btn btn-ghost">Filtrer</button>
  <a class="btn btn-ghost" href="/admin/contacts.csv${q}">Exporter en CSV</a>
</form>
${opts.leads.length ? html`<div class="table-wrap"><table class="list"><thead><tr><th>Date</th><th>Contact</th><th>Événement</th><th>Statut</th><th></th></tr></thead><tbody>
${opts.leads.map((l) => html`<tr>
<td>${frDate(l.createdAt)}</td>
<td><strong>${l.firstName} ${l.lastName}</strong>${l.company ? html`<br>${l.company}` : ''}${l.email ? html`<br><a href="mailto:${l.email}">${l.email}</a>` : ''}${l.phone ? html`<br><a href="tel:${l.phone.replace(/[^+0-9]/g, '')}">${l.phone}</a>` : ''}</td>
<td>${l.eventName ?? '—'}</td>
<td>${status('email', l.emailStatus)}<br>${status('folk', l.folkStatus)}${l.lastError ? html`<br><small class="field-error">${l.lastError}</small>` : ''}</td>
<td>
  ${l.folkStatus === 'error' || l.folkStatus === 'retry' ? html`<form method="post" action="/admin/contacts/${l.id}/renvoyer">${csrfField(opts.csrf)}<button class="linklike">Renvoyer vers Folk</button></form>` : ''}
  <form method="post" action="/admin/contacts/${l.id}/supprimer" data-confirm="Supprimer définitivement ce contact ?">${csrfField(opts.csrf)}<button class="linklike">Supprimer</button></form>
</td></tr>`)}
</tbody></table></div>` : html`<p class="muted">Aucun contact pour l'instant.</p>`}` , scripts: ['/static/admin.js'] });
}

export function waitlistPage(opts: { csrf: string; rows: WaitlistRow[] }): SafeHtml {
  return adminLayout({ title: "Liste d'attente", current: '/admin/liste-attente', csrf: opts.csrf, body: html`
<div class="toolbar"><a class="btn btn-ghost" href="/admin/liste-attente.csv">Exporter en CSV</a></div>
${opts.rows.length ? html`<div class="table-wrap"><table class="list"><thead><tr><th>Date</th><th>E-mail</th><th></th></tr></thead><tbody>
${opts.rows.map((r) => html`<tr><td>${frDate(r.createdAt)}</td><td><a href="mailto:${r.email}">${r.email}</a></td>
<td><form method="post" action="/admin/liste-attente/${r.id}/supprimer" data-confirm="Supprimer cette inscription ?">${csrfField(opts.csrf)}<button class="linklike">Supprimer</button></form></td></tr>`)}
</tbody></table></div>` : html`<p class="muted">Personne n'est encore inscrit.</p>`}`, scripts: ['/static/admin.js'] });
}
