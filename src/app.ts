import type { Database } from './db/index.ts';
import type { Config } from './config.ts';
import type { Mailer } from './leads/mailer.ts';
import { Router } from './http/router.ts';
import { dispatchLead } from './leads/dispatcher.ts';
import { authRoutes } from './auth/routes.ts';
import { adminRoutes, adminShareRoutes } from './admin/routes.ts';
import { publicRoutes, exchangeRoutes, notFound } from './public/routes.ts';

export type Deps = { db: Database; config: Config; now: () => Date; fetch: typeof fetch; mailer: Mailer };
export type App = (req: Request) => Promise<Response>;

export function createApp(deps: Deps): App {
  const router = new Router();
  router.get('/health', () => new Response('ok'));
  publicRoutes(router, deps);
  authRoutes(router, deps);
  adminRoutes(router, deps);
  adminShareRoutes(router, deps);
  exchangeRoutes(router, deps, (id) => { dispatchLead(deps, id).catch((e) => console.error('Envoi du contact', id, e)); });
  return async (req) => {
    let res: Response;
    try {
      res = await router.handle(req, notFound);
    } catch (e) {
      console.error(e);
      res = new Response('Erreur interne', { status: 500 });
    }
    return withSecurityHeaders(res);
  };
}

const SECURITY_HEADERS: Record<string, string> = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'SAMEORIGIN',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'strict-transport-security': 'max-age=31536000',
  'content-security-policy':
    "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; frame-ancestors 'self'; form-action 'self'; base-uri 'none'; object-src 'none'",
};

function withSecurityHeaders(res: Response): Response {
  if (res.status >= 300 && res.status < 400 && !res.body) {
    const r = new Response(null, { status: res.status, headers: res.headers });
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) r.headers.set(k, v);
    return r;
  }
  try {
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.headers.set(k, v);
    return res;
  } catch {
    const r = new Response(res.body, { status: res.status, headers: res.headers });
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) r.headers.set(k, v);
    return r;
  }
}
