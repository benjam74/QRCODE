import type { Database } from './db/index.ts';
import type { Config } from './config.ts';
import type { Mailer } from './leads/mailer.ts';
import { Router } from './http/router.ts';

export type Deps = { db: Database; config: Config; now: () => Date; fetch: typeof fetch; mailer: Mailer };
export type App = (req: Request) => Promise<Response>;

export function createApp(deps: Deps): App {
  const router = new Router();
  router.get('/health', () => new Response('ok'));
  const notFound = () => new Response('Page introuvable', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  return async (req) => {
    try {
      return await router.handle(req, notFound);
    } catch (e) {
      console.error(e);
      return new Response('Erreur interne', { status: 500 });
    }
  };
}
