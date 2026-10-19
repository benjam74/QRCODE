import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import type { Deps } from '../app.ts';
import { Router, redirect, type Ctx } from '../http/router.ts';
import { htmlResponse } from '../http/html.ts';
import { requireSession, csrfProtect, vars } from '../auth/middleware.ts';
import { getCardsForUser, saveCard, setCardPhoto, SlugTakenError } from '../cards/repo.ts';
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
