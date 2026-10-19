import { html, type SafeHtml } from '../../http/html.ts';
import { layout } from '../../public/views/layout.ts';

const NAV: [string, string][] = [
  ['/admin/carte', 'Ma carte'],
  ['/admin/partager', 'Partager'],
  ['/admin/evenements', 'Événements'],
  ['/admin/contacts', 'Contacts'],
  ['/admin/liste-attente', "Liste d'attente"],
];

export function adminLayout(opts: { title: string; current: string; csrf: string; body: SafeHtml; scripts?: string[] }): SafeHtml {
  return layout({
    title: `${opts.title} — administration`,
    scripts: opts.scripts,
    head: html`<link rel="stylesheet" href="/static/admin.css"><meta name="robots" content="noindex">`,
    body: html`
<div class="admin">
  <header class="admin-top">
    <nav aria-label="Administration">${NAV.map(([href, label]) => html`<a href="${href}"${href === opts.current ? html` aria-current="page"` : ''}>${label}</a>`)}</nav>
    <form method="post" action="/admin/logout"><input type="hidden" name="_csrf" value="${opts.csrf}"><button class="linklike">Se déconnecter</button></form>
  </header>
  <main class="admin-main"><h1>${opts.title}</h1>${opts.body}</main>
</div>`,
  });
}

export function csrfField(csrf: string): SafeHtml {
  return html`<input type="hidden" name="_csrf" value="${csrf}">`;
}
