import { html, type SafeHtml } from '../../http/html.ts';
import { simplePage } from '../../public/views/simple.ts';

export function loginPage(message?: string): SafeHtml {
  return simplePage('Connexion', html`
<div class="notice">
  <h1>Connexion</h1>
  ${message ? html`<p role="status">${message}</p>` : html`<p>Indiquez votre adresse e-mail : vous recevrez un lien de connexion valable 15 minutes.</p>`}
  <form method="post" action="/admin/login">
    <label>E-mail<input type="email" name="email" autocomplete="email" required></label>
    <button class="btn btn-primary">Recevoir le lien</button>
  </form>
</div>`);
}

export function verifyPage(token: string): SafeHtml {
  return simplePage('Connexion', html`
<div class="notice">
  <h1>Connexion</h1>
  <form method="post" action="/admin/login/verify">
    <input type="hidden" name="token" value="${token}">
    <button class="btn btn-primary">Me connecter</button>
  </form>
</div>`);
}

export function expiredPage(): SafeHtml {
  return simplePage('Lien expiré', html`<div class="notice"><h1>Lien expiré</h1><p>Ce lien a expiré ou a déjà servi.</p><p><a href="/admin/login">Demander un nouveau lien</a></p></div>`);
}
