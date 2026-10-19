import type { Deps } from '../app.ts';
import { Router, redirect } from '../http/router.ts';
import { htmlResponse } from '../http/html.ts';
import { getCookie, sessionCookie } from '../http/cookies.ts';
import { createRateLimiter, clientIp } from '../security/rateLimit.ts';
import { formFields } from '../public/routes.ts';
import { findUserByEmail, createLoginToken, consumeLoginToken, createSession, deleteSession, SESSION_TTL_MS } from './repo.ts';
import { requireSession, csrfProtect } from './middleware.ts';
import { loginPage, verifyPage, expiredPage } from '../admin/views/login.ts';

export const LOGIN_SENT = "Si cette adresse est autorisée, un lien de connexion vient d'être envoyé.";

export function authRoutes(router: Router, deps: Deps): void {
  const limiter = createRateLimiter(5, 3_600_000, () => deps.now().getTime());

  router.get('/admin/login', () => htmlResponse(loginPage(), 200, { 'cache-control': 'no-store' }));

  router.post('/admin/login', async (ctx) => {
    const fields = await formFields(ctx.req);
    const email = (fields.email ?? '').trim().toLowerCase();
    if (!limiter.hit(clientIp(ctx.req))) return htmlResponse(loginPage(LOGIN_SENT));
    const userId = email ? findUserByEmail(deps.db, email) : null;
    if (userId) {
      const t = createLoginToken(deps.db, userId, deps.now());
      const link = `${deps.config.baseUrl}/admin/login/verify?token=${t}`;
      await deps.mailer.send({
        to: email,
        subject: 'Votre lien de connexion',
        text: `Bonjour,\n\nVoici votre lien de connexion à l'administration de votre carte, valable 15 minutes :\n\n${link}\n\nSi vous n'avez rien demandé, ignorez cet e-mail.`,
      }).catch((e) => console.error('Envoi du lien de connexion :', e));
    }
    return htmlResponse(loginPage(LOGIN_SENT));
  });

  // Le GET n'utilise pas le jeton : les antivirus de messagerie ouvrent les liens et le consommeraient.
  router.get('/admin/login/verify', (ctx) => htmlResponse(verifyPage(ctx.url.searchParams.get('token') ?? ''), 200, { 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' }));

  router.post('/admin/login/verify', async (ctx) => {
    const { token } = await formFields(ctx.req);
    const userId = token ? consumeLoginToken(deps.db, token, deps.now()) : null;
    if (!userId) return htmlResponse(expiredPage(), 400);
    const s = createSession(deps.db, userId, deps.now());
    return new Response(null, { status: 302, headers: { location: '/admin', 'set-cookie': sessionCookie(s.id, SESSION_TTL_MS / 1000) } });
  });

  router.post('/admin/logout', requireSession(deps), csrfProtect, (ctx) => {
    const sid = getCookie(ctx.req, 'sid');
    if (sid) deleteSession(deps.db, sid);
    return new Response(null, { status: 302, headers: { location: '/admin/login', 'set-cookie': sessionCookie('', 0) } });
  });

  router.get('/admin', requireSession(deps), () => redirect('/admin/carte'));
}
