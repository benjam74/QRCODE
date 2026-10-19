export class SafeHtml {
  readonly value: string;
  constructor(value: string) { this.value = value; }
  toString() { return this.value; }
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

function render(v: unknown): string {
  if (v === null || v === undefined || v === false) return '';
  if (v instanceof SafeHtml) return v.value;
  if (Array.isArray(v)) return v.map(render).join('');
  return escapeHtml(String(v));
}

export function html(strings: TemplateStringsArray, ...values: unknown[]): SafeHtml {
  let out = strings[0];
  values.forEach((v, i) => { out += render(v) + strings[i + 1]; });
  return new SafeHtml(out);
}

export function raw(s: string): SafeHtml { return new SafeHtml(s); }

export function htmlResponse(body: SafeHtml, status = 200, headers: Record<string, string> = {}): Response {
  return new Response('<!doctype html>' + body.value, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8', ...headers },
  });
}
