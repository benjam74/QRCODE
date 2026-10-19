import { html, type SafeHtml } from '../../http/html.ts';
import { layout } from './layout.ts';

export function simplePage(title: string, content: SafeHtml, accent?: string): SafeHtml {
  return layout({ title, accent, body: html`<main class="card page">${content}</main>` });
}

export function notFoundPage(): SafeHtml {
  return simplePage('Page introuvable', html`<h1>Page introuvable</h1><p>Cette carte n'existe pas ou n'est plus en ligne.</p>`);
}
