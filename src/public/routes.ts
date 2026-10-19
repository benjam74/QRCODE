import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import type { Deps } from '../app.ts';
import { Router, redirect, type Ctx } from '../http/router.ts';
import { htmlResponse } from '../http/html.ts';
import { serveFile } from '../http/static.ts';
import { getCardBySlug } from '../cards/repo.ts';
import type { CardFull } from '../cards/types.ts';
import { buildVCard, vcardFilename } from '../cards/vcard.ts';
import { findEvent, recordScan } from '../leads/repo.ts';
import { renderCardPage } from './views/card.ts';
import { notFoundPage } from './views/simple.ts';

export const STATIC_DIR = join(import.meta.dirname, '..', '..', 'static');

export function notFound(): Response {
  return htmlResponse(notFoundPage(), 404);
}

/** Résout le slug : renvoie la carte, une redirection 301 ou une 404. */
export function resolveCard(deps: Deps, ctx: Ctx, suffix = ''): { card: CardFull } | Response {
  const r = getCardBySlug(deps.db, ctx.params.slug);
  if (!r) return notFound();
  if ('redirectTo' in r) return redirect(`/c/${encodeURIComponent(r.redirectTo)}${suffix}${ctx.url.search}`, 301);
  return r;
}

export function publicRoutes(router: Router, deps: Deps): void {
  router.get('/static/:file', async ({ params }) => (await serveFile(STATIC_DIR, params.file, 'public, max-age=3600')) ?? notFound());

  router.get('/media/:file', async ({ params }) =>
    (await serveFile(join(deps.config.dataDir, 'media'), params.file, 'public, max-age=31536000, immutable')) ?? notFound());

  router.get('/c/:slug', (ctx) => {
    const r = resolveCard(deps, ctx);
    if (r instanceof Response) return r;
    const eSlug = ctx.url.searchParams.get('e');
    const event = eSlug ? findEvent(deps.db, r.card.id, eSlug) : null;
    if (ctx.req.method === 'GET') recordScan(deps.db, r.card.id, event?.id ?? null, deps.now().toISOString().slice(0, 10));
    return htmlResponse(renderCardPage({ card: r.card, baseUrl: deps.config.baseUrl, ownerName: deps.config.ownerName, eventSlug: event ? eSlug : null }));
  });

  router.get('/c/:slug/contact.vcf', async (ctx) => {
    const r = resolveCard(deps, ctx, '/contact.vcf');
    if (r instanceof Response) return r;
    let photo: Buffer | null = null;
    if (r.card.photoFile) photo = await readFile(join(deps.config.dataDir, 'media', r.card.photoFile)).catch(() => null);
    return new Response(buildVCard(r.card, photo), {
      headers: {
        'content-type': 'text/vcard; charset=utf-8',
        'content-disposition': `attachment; filename="${vcardFilename(r.card)}"`,
        'cache-control': 'no-cache',
      },
    });
  });
}
