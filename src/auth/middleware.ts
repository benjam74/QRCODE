import { timingSafeEqual } from 'node:crypto';
import type { Deps } from '../app.ts';
import type { Handler } from '../http/router.ts';
import { redirect } from '../http/router.ts';
import { getCookie } from '../http/cookies.ts';
import { getSession } from './repo.ts';

export type AdminVars = { userId: number; csrf: string; sid: string; formData?: FormData };

export function requireSession(deps: Deps): Handler {
  return (ctx) => {
    const sid = getCookie(ctx.req, 'sid');
    const s = sid ? getSession(deps.db, sid, deps.now()) : null;
    if (!s || !sid) return redirect('/admin/login');
    Object.assign(ctx.vars, { userId: s.userId, csrf: s.csrf, sid } satisfies AdminVars);
  };
}

export const csrfProtect: Handler = async (ctx) => {
  if (ctx.req.method === 'GET' || ctx.req.method === 'HEAD') return;
  let fd: FormData;
  try {
    fd = await ctx.req.formData();
  } catch {
    return new Response('Requête invalide', { status: 400 });
  }
  const sent = fd.get('_csrf');
  const expected = String(ctx.vars.csrf ?? '');
  const a = Buffer.from(typeof sent === 'string' ? sent : '');
  const b = Buffer.from(expected);
  if (!expected || a.length !== b.length || !timingSafeEqual(a, b)) {
    return new Response('Session expirée, rechargez la page.', { status: 403, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }
  ctx.vars.formData = fd;
};

export function vars(ctx: { vars: Record<string, unknown> }): AdminVars {
  return ctx.vars as unknown as AdminVars;
}
