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

import { validateLead, validateWaitlist } from '../leads/validate.ts';
import { createLeadDeduped, addToWaitlist } from '../leads/repo.ts';
import { createRateLimiter, clientIp } from '../security/rateLimit.ts';
import { CONSENT_VERSION } from './views/card.ts';
import { privacyPage, thanksPage, tooManyPage } from './views/privacy.ts';

export async function formFields(req: Request): Promise<Record<string, string>> {
  const fd = await req.formData();
  const out: Record<string, string> = {};
  fd.forEach((v, k) => { if (typeof v === 'string') out[k] = v; });
  return out;
}

export type LeadCreatedHook = (leadId: number) => void;

export function exchangeRoutes(router: Router, deps: Deps, onLeadCreated: LeadCreatedHook = () => {}): void {
  const limiter = createRateLimiter(5, 3_600_000, () => deps.now().getTime());
  const waitLimiter = createRateLimiter(5, 3_600_000, () => deps.now().getTime());

  router.get('/confidentialite', () => htmlResponse(privacyPage(deps.config.ownerName, deps.config.adminEmail)));

  router.post('/c/:slug/echange', async (ctx) => {
    const r = resolveCard(deps, ctx);
    if (r instanceof Response) return r.status === 301 ? redirect(r.headers.get('location') as string, 307) : r;
    const { card } = r;
    if (!limiter.hit(clientIp(ctx.req))) return htmlResponse(tooManyPage(card.slug), 429);
    const fields = await formFields(ctx.req);
    const v = validateLead(fields);
    const thanks = () => htmlResponse(thanksPage(card.firstName, card.slug, card.accentColor));
    if (!v.ok) {
      if (v.errors._bot) return thanks();
      const event = fields.event ? findEvent(deps.db, card.id, fields.event) : null;
      return htmlResponse(renderCardPage({
        card, baseUrl: deps.config.baseUrl, ownerName: deps.config.ownerName, eventSlug: event ? fields.event : null,
        exchange: { values: fields, errors: v.errors },
      }), 422);
    }
    const event = v.value.eventSlug ? findEvent(deps.db, card.id, v.value.eventSlug) : null;
    const created = createLeadDeduped(deps.db, card.id, card.userId, event?.id ?? null, v.value, CONSENT_VERSION, deps.now());
    if (!created.duplicate) onLeadCreated(created.id);
    return thanks();
  });

  router.post('/c/:slug/liste-attente', async (ctx) => {
    const r = resolveCard(deps, ctx);
    if (r instanceof Response) return r.status === 301 ? redirect(r.headers.get('location') as string, 307) : r;
    const { card } = r;
    if (!waitLimiter.hit(clientIp(ctx.req))) return htmlResponse(tooManyPage(card.slug), 429);
    const fields = await formFields(ctx.req);
    const v = validateWaitlist(fields);
    if (!v.ok) {
      return htmlResponse(renderCardPage({
        card, baseUrl: deps.config.baseUrl, ownerName: deps.config.ownerName, eventSlug: null, waitlist: { values: fields, errors: v.errors },
      }), 422);
    }
    addToWaitlist(deps.db, card.userId, v.value.email, deps.now());
    return htmlResponse(thanksPage(card.firstName, card.slug, card.accentColor, "C'est noté : vous serez prévenu à l'ouverture du service."));
  });
}
