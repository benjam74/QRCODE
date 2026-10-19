import { html, type SafeHtml } from '../../http/html.ts';

export function layout(opts: { title: string; head?: SafeHtml; body: SafeHtml; accent?: string; scripts?: string[] }): SafeHtml {
  const accent = /^#[0-9a-fA-F]{6}$/.test(opts.accent ?? '') ? opts.accent : '#1F4E79';
  return html`<html lang="fr"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${opts.title}</title>
<link rel="stylesheet" href="/static/style.css">
<style>:root{--accent:${accent}}</style>
${opts.head ?? ''}
</head><body>
${opts.body}
${(opts.scripts ?? []).map((s) => html`<script src="${s}" defer></script>`)}
</body></html>`;
}
