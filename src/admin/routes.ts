import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import type { Deps } from '../app.ts';
import { Router, redirect, type Ctx } from '../http/router.ts';
import { htmlResponse } from '../http/html.ts';
import { requireSession, csrfProtect, vars } from '../auth/middleware.ts';
import { getCardsForUser, getCardBySlug, saveCard, setCardPhoto, SlugTakenError } from '../cards/repo.ts';
import type { CardFull } from '../cards/types.ts';
import { processPhoto, savePhoto, InvalidImageError, ogFileName } from '../media/photo.ts';
import { parseCardForm } from './cardForm.ts';
import { cardFormPage } from './views/cardForm.ts';

export function formRecord(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  fd.forEach((v, k) => { if (typeof v === 'string') out[k] = v; });
  return out;
}

/** v1 : un utilisateur = une carte. */
export function currentCard(deps: Deps, ctx: Ctx): CardFull {
  const card = getCardsForUser(deps.db, vars(ctx).userId)[0];
  if (!card) throw new Error('Aucune carte pour cet utilisateur');
  return card;
}

async function removePhotoFiles(dataDir: string, file: string | null) {
  if (!file) return;
  for (const f of [file, ogFileName(file)]) await unlink(join(dataDir, 'media', f)).catch(() => {});
}

export function adminRoutes(router: Router, deps: Deps): void {
  const auth = [requireSession(deps), csrfProtect];
  const noStore = { 'cache-control': 'no-store' };

  router.get('/admin/carte', ...auth, (ctx) => {
    const v = vars(ctx);
    return htmlResponse(cardFormPage({ card: currentCard(deps, ctx), csrf: v.csrf, baseUrl: deps.config.baseUrl, saved: ctx.url.searchParams.get('ok') === '1' }), 200, noStore);
  });

  router.post('/admin/carte', ...auth, (ctx) => {
    const v = vars(ctx);
    const card = currentCard(deps, ctx);
    const fd = formRecord(v.formData as FormData);
    const parsed = parseCardForm(fd);
    if (!parsed.ok) return htmlResponse(cardFormPage({ card, csrf: v.csrf, baseUrl: deps.config.baseUrl, errors: parsed.errors, values: parsed.values }), 422, noStore);
    try {
      saveCard(deps.db, card.id, parsed.value, deps.now());
    } catch (e) {
      if (e instanceof SlugTakenError) {
        return htmlResponse(cardFormPage({ card, csrf: v.csrf, baseUrl: deps.config.baseUrl, errors: { slug: e.message }, values: fd }), 422, noStore);
      }
      throw e;
    }
    return redirect('/admin/carte?ok=1');
  });

  router.post('/admin/carte/photo', ...auth, async (ctx) => {
    const v = vars(ctx);
    const card = currentCard(deps, ctx);
    const fd = v.formData as FormData;
    const file = fd.get('photo');
    const fail = (msg: string) => htmlResponse(cardFormPage({ card, csrf: v.csrf, baseUrl: deps.config.baseUrl, photoError: msg }), 422, noStore);
    if (!(file instanceof File) || file.size === 0) return fail('Choisissez une photo.');
    const num = (k: string) => Number(fd.get(k));
    const crop = fd.get('crop_size') ? { x: num('crop_x'), y: num('crop_y'), size: num('crop_size') } : undefined;
    try {
      const out = await processPhoto(Buffer.from(await file.arrayBuffer()), crop);
      const name = await savePhoto(deps.config.dataDir, card.id, out, deps.now());
      setCardPhoto(deps.db, card.id, name, deps.now());
      await removePhotoFiles(deps.config.dataDir, card.photoFile);
    } catch (e) {
      if (e instanceof InvalidImageError) return fail(e.message);
      throw e;
    }
    return redirect('/admin/carte?ok=1');
  });

  router.post('/admin/carte/photo/supprimer', ...auth, async (ctx) => {
    const card = currentCard(deps, ctx);
    setCardPhoto(deps.db, card.id, null, deps.now());
    await removePhotoFiles(deps.config.dataDir, card.photoFile);
    return redirect('/admin/carte?ok=1');
  });
}

import { qrPng, qrSvg } from '../qr.ts';
import { signatureHtml } from './signature.ts';
import { toCsv } from './csv.ts';
import { sharePage, eventsPage, leadsPage, waitlistPage } from './views/pages.ts';
import { createEvent, findEvent, eventStats, totalScans, listEvents, listLeads, deleteLead, resetFolk, listWaitlist, deleteWaitlist } from '../leads/repo.ts';
import { dispatchLead } from '../leads/dispatcher.ts';
import { notFound } from '../public/routes.ts';

const frDateTime = (iso: string) => new Date(iso).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });

function csvResponse(rows: string[][], name: string): Response {
  return new Response(toCsv(rows), { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${name}"`, 'cache-control': 'no-store' } });
}

export function adminShareRoutes(router: Router, deps: Deps): void {
  const auth = [requireSession(deps), csrfProtect];
  const today = () => deps.now().toISOString().slice(0, 10);

  router.get('/admin/partager', ...auth, (ctx) => {
    const card = currentCard(deps, ctx);
    return htmlResponse(sharePage({ card, csrf: vars(ctx).csrf, baseUrl: deps.config.baseUrl, signature: signatureHtml(card, deps.config.baseUrl) }), 200, { 'cache-control': 'no-store' });
  });

  for (const ext of ['png', 'svg'] as const) {
    router.get(`/admin/qr.${ext}`, ...auth, async (ctx) => {
      const card = currentCard(deps, ctx);
      const e = ctx.url.searchParams.get('e');
      if (e && !findEvent(deps.db, card.id, e)) return notFound();
      const target = `${deps.config.baseUrl}/c/${card.slug}${e ? `?e=${encodeURIComponent(e)}` : ''}`;
      const filename = `qr-${card.slug}${e ? `-${e}` : ''}.${ext}`;
      const disposition = ctx.url.searchParams.get('inline') ? 'inline' : `attachment; filename="${filename}"`;
      const body = ext === 'png' ? await qrPng(target, 1024) : await qrSvg(target);
      return new Response(body as BodyInit, { headers: { 'content-type': ext === 'png' ? 'image/png' : 'image/svg+xml', 'content-disposition': disposition, 'cache-control': 'no-store' } });
    });
  }

  router.get('/c/:slug/qr.png', async (ctx) => {
    const r = getCardBySlug(deps.db, ctx.params.slug);
    if (!r) return notFound();
    if ('redirectTo' in r) return redirect(`/c/${encodeURIComponent(r.redirectTo)}/qr.png`, 301);
    const png = await qrPng(`${deps.config.baseUrl}/c/${r.card.slug}`, 160);
    return new Response(png as BodyInit, { headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=86400' } });
  });

  router.get('/admin/evenements', ...auth, (ctx) => {
    const card = currentCard(deps, ctx);
    return htmlResponse(eventsPage({ csrf: vars(ctx).csrf, stats: eventStats(deps.db, card.id), totalScans: totalScans(deps.db, card.id) }), 200, { 'cache-control': 'no-store' });
  });

  router.post('/admin/evenements', ...auth, (ctx) => {
    const v = vars(ctx);
    const card = currentCard(deps, ctx);
    const fd = formRecord(v.formData as FormData);
    const name = (fd.name ?? '').trim();
    const date = /^\d{4}-\d{2}-\d{2}$/.test(fd.date ?? '') ? fd.date : null;
    if (!name || name.length > 120) {
      return htmlResponse(eventsPage({ csrf: v.csrf, stats: eventStats(deps.db, card.id), totalScans: totalScans(deps.db, card.id), error: "Indiquez le nom de l'événement (120 caractères maximum)." }), 422);
    }
    createEvent(deps.db, v.userId, card.id, name, date, deps.now());
    return redirect('/admin/evenements');
  });

  router.get('/admin/contacts', ...auth, (ctx) => {
    const v = vars(ctx);
    const card = currentCard(deps, ctx);
    const e = ctx.url.searchParams.get('e') || null;
    const ev = e ? findEvent(deps.db, card.id, e) : null;
    const leads = e && !ev ? [] : listLeads(deps.db, v.userId, ev?.id);
    return htmlResponse(leadsPage({ csrf: v.csrf, leads, events: listEvents(deps.db, card.id), current: e }), 200, { 'cache-control': 'no-store' });
  });

  router.get('/admin/contacts.csv', ...auth, (ctx) => {
    const v = vars(ctx);
    const card = currentCard(deps, ctx);
    const e = ctx.url.searchParams.get('e') || null;
    const ev = e ? findEvent(deps.db, card.id, e) : null;
    const leads = e && !ev ? [] : listLeads(deps.db, v.userId, ev?.id);
    const rows = [['Date', 'Prénom', 'Nom', 'E-mail', 'Téléphone', 'Société', 'Événement', 'Folk'],
      ...leads.map((l) => [frDateTime(l.createdAt), l.firstName, l.lastName, l.email ?? '', l.phone ?? '', l.company ?? '', l.eventName ?? '', l.folkStatus])];
    return csvResponse(rows, `contacts-${today()}.csv`);
  });

  router.post('/admin/contacts/:id/renvoyer', ...auth, (ctx) => {
    const id = Number(ctx.params.id);
    if (!resetFolk(deps.db, vars(ctx).userId, id)) return notFound();
    dispatchLead(deps, id).catch((e) => console.error('Renvoi Folk', id, e));
    return redirect('/admin/contacts');
  });

  router.post('/admin/contacts/:id/supprimer', ...auth, (ctx) => {
    if (!deleteLead(deps.db, vars(ctx).userId, Number(ctx.params.id))) return notFound();
    return redirect('/admin/contacts');
  });

  router.get('/admin/liste-attente', ...auth, (ctx) => htmlResponse(waitlistPage({ csrf: vars(ctx).csrf, rows: listWaitlist(deps.db, vars(ctx).userId) }), 200, { 'cache-control': 'no-store' }));

  router.get('/admin/liste-attente.csv', ...auth, (ctx) =>
    csvResponse([['Date', 'E-mail'], ...listWaitlist(deps.db, vars(ctx).userId).map((r) => [frDateTime(r.createdAt), r.email])], `liste-attente-${today()}.csv`));

  router.post('/admin/liste-attente/:id/supprimer', ...auth, (ctx) => {
    if (!deleteWaitlist(deps.db, vars(ctx).userId, Number(ctx.params.id))) return notFound();
    return redirect('/admin/liste-attente');
  });
}
