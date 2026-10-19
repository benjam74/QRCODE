import { html, type SafeHtml } from '../../http/html.ts';
import { simplePage } from './simple.ts';

export function privacyPage(ownerName: string, contactEmail: string): SafeHtml {
  return simplePage('Confidentialité', html`
<h1>Confidentialité</h1>
<p><strong>Responsable du traitement :</strong> ${ownerName}, joignable à <a href="mailto:${contactEmail}">${contactEmail}</a>.</p>
<h2>Ce qui est collecté</h2>
<p>Quand vous utilisez le formulaire « Échangeons nos coordonnées » : votre prénom, votre nom, votre e-mail et/ou votre téléphone, votre société si vous la donnez, la date et l'événement où nous nous sommes rencontrés. Quand vous vous inscrivez à la liste d'attente : votre e-mail.</p>
<h2>Pourquoi</h2>
<p>Uniquement pour vous recontacter dans un cadre professionnel, ou vous prévenir de l'ouverture du service si vous vous êtes inscrit à la liste d'attente. Vos données ne sont ni vendues ni cédées.</p>
<h2>Base légale</h2>
<p>Votre consentement, donné en cochant la case du formulaire. Vous pouvez le retirer à tout moment.</p>
<h2>Durée de conservation</h2>
<p>3 ans après notre dernier contact, puis suppression.</p>
<h2>Sous-traitants</h2>
<ul>
  <li>Infomaniak (Suisse) : hébergement de ce site et envoi des e-mails.</li>
  <li>Folk : outil de gestion des contacts dans lequel vos coordonnées sont enregistrées.</li>
</ul>
<h2>Cookies et mesure d'audience</h2>
<p>Les pages publiques ne déposent aucun cookie et n'utilisent aucun outil de mesure d'audience. Le nombre de visites est compté sans enregistrer votre adresse IP.</p>
<h2>Vos droits</h2>
<p>Vous disposez d'un droit d'accès, de rectification, d'effacement, d'opposition et de portabilité sur vos données (RGPD et loi suisse sur la protection des données). Écrivez à <a href="mailto:${contactEmail}">${contactEmail}</a>. En cas de désaccord, vous pouvez saisir la CNIL (France) ou le PFPDT (Suisse).</p>`);
}

export function thanksPage(ownerFirstName: string, cardSlug: string, accent: string, message?: string): SafeHtml {
  return simplePage('Merci', html`
<div class="notice">
  <h1>Merci</h1>
  <p>${message ?? `Merci, ${ownerFirstName} a bien reçu vos coordonnées.`}</p>
  <p><a class="btn btn-ghost" href="/c/${cardSlug}">Revenir à la carte</a></p>
</div>`, accent);
}

export function tooManyPage(cardSlug: string): SafeHtml {
  return simplePage('Trop d\'envois', html`<div class="notice"><h1>Un instant</h1><p>Trop d'envois, réessayez dans une heure.</p><p><a href="/c/${cardSlug}">Revenir à la carte</a></p></div>`);
}
