# Carte QR : spécification v1

Date : 19/10/2026. Statut : à valider par Benjamin.
Nom de travail du projet : `carte-qr` (le nom commercial reste à choisir).

## 1. Objectif

Une application web hébergée par Benjamin qui sert à deux choses :

1. Partager sa carte de visite numérique par QR code (en face à face) et par lien (signature d'e-mail, WhatsApp, LinkedIn).
2. Récupérer les coordonnées des personnes rencontrées, avec leur accord, et les faire arriver dans Folk sans ressaisie.

Elle sert aussi d'aimant à prospects : la v2 ouvrira l'inscription gratuite, et la v1 récolte déjà une liste d'attente.

### Critères de réussite de la v1

- Un iPhone et un Android scannent le QR code avec l'appareil photo natif et ouvrent la carte en moins de 2 secondes en 4G.
- « Enregistrer le contact » crée la fiche avec photo, téléphone, e-mail, réseaux et fonction, sur iPhone et sur Android.
- Une personne qui remplit « Échangeons nos coordonnées » apparaît dans Folk, dans le bon groupe, avec l'événement noté, en moins d'une minute.
- Le lien collé dans WhatsApp et LinkedIn affiche la photo, le nom et la fonction.
- Une panne du serveur ne fait perdre au plus qu'une journée de données.

## 2. Ce que Benjamin a dit, ce qui est supposé

**Dit :** nom, prénom, fonction sur 2 lignes, téléphone, e-mail, liens réseaux, champs libres, photo. Sortie en QR code. Partage depuis le smartphone et en signature d'e-mail. Récupérer les coordonnées de la personne en face. Approche par étapes (v1 sa carte, v2 inscription gratuite, code éventuellement publié sur GitHub). Claude Code, serveur Infomaniak. Contacts récupérés par e-mail, en liste d'administration et dans Folk. Bloc « parcours visiteur » validé le 19/10/2026.

**Supposé (à corriger si faux) :**
- Un champ « Société » facultatif en plus des champs demandés : il remplit le champ ORG de la fiche contact.
- Un bouton WhatsApp utilisant le numéro pro.
- Une couleur d'accent réglable pour la carte, plutôt qu'un choix de thèmes.
- Interface en français uniquement.
- Un seul compte en v1 : celui de Benjamin.

## 3. Périmètre

### Dans la v1

- Page publique de la carte, fiche contact téléchargeable, formulaire d'échange.
- Espace d'administration : édition de la carte, événements et leurs QR codes, contacts reçus, liste d'attente, bloc signature d'e-mail.
- Envoi des contacts par e-mail et dans Folk.
- Sauvegarde automatique quotidienne hors du serveur.
- Page de confidentialité.

### Hors v1 (prévu pour la v2 ou plus tard)

- Inscription publique et plusieurs comptes (la base de données est prête, l'inscription est fermée).
- Paiement, offre payante.
- Statistiques détaillées (on garde un simple compteur de scans par événement).
- Ajout au portefeuille Apple ou Google (Wallet).
- Lecture de cartes papier par photo.
- Multilingue.

## 4. Parcours de la personne qui scanne (validé)

Le QR code contient seulement l'adresse de la carte : `https://<domaine>/c/<identifiant>`, avec `?e=<evenement>` pour un QR code d'événement. Modifier la carte ne rend jamais un QR imprimé caduc.

Page de la carte, conçue d'abord pour mobile, dans cet ordre :

1. Photo (ou initiales sur fond de couleur d'accent si pas de photo), prénom et nom, fonction ligne 1, fonction ligne 2, société si renseignée.
2. Bouton principal « Enregistrer le contact » : télécharge `prenom-nom.vcf`.
3. Boutons d'action : appeler, e-mail, WhatsApp. Puis les icônes des réseaux.
4. Champs libres : libellé et valeur. Une valeur qui commence par `http` devient un lien.
5. Encadré « Échangeons nos coordonnées » :
   - prénom (obligatoire), nom (obligatoire), e-mail ou téléphone (au moins un), société (facultatif) ;
   - bouton « Choisir ma fiche » si le navigateur prend en charge la sélection de contact (Chrome sur Android ; absent sur iPhone, le bouton n'apparaît pas) ;
   - case de consentement non cochée, obligatoire, avec lien vers la page de confidentialité ;
   - après envoi : message de remerciement sur la même page.
6. Juste après un appui sur « Enregistrer le contact », l'encadré d'échange est mis en avant (défilement doux et mise en évidence).
7. Pied de page : « Créer ma carte gratuite », qui mène à un formulaire de liste d'attente (e-mail et consentement).

La page fonctionne sans JavaScript : le formulaire s'envoie normalement, seuls la sélection de contact et la mise en avant disparaissent.

L'aperçu de lien (balises Open Graph) contient le nom, la fonction et la photo. La photo d'aperçu est générée en 1200×630.

## 5. Espace d'administration

Accès par `https://<domaine>/admin`. Connexion par lien magique envoyé par e-mail : on saisit son adresse, on reçoit un lien valable 15 minutes et utilisable une seule fois. La session dure 30 jours. En v1, seule l'adresse définie dans la configuration (`ADMIN_EMAIL`) peut se connecter.

Écrans :

1. **Ma carte** : tous les champs, la liste des réseaux (type, adresse, ordre), les champs libres (libellé, valeur, ordre), la photo (envoi, recadrage carré), l'identifiant d'adresse, la couleur d'accent. Aperçu mobile à côté.
2. **Partager** :
   - QR code de la carte, à télécharger en PNG (impression, écran) et en SVG (imprimeur) ;
   - bloc de signature d'e-mail prêt à copier : petite photo, nom, fonction, lien « Ma carte de visite », petit QR code. Le lien est l'élément principal, le QR code est secondaire.
3. **Événements** : créer un événement (nom, date), obtenir son QR code, voir le nombre de scans et de contacts reçus.
4. **Contacts reçus** : liste avec date, événement, coordonnées et statut Folk (envoyé, en attente, erreur). Filtre par événement, export CSV, bouton « Renvoyer vers Folk », suppression.
5. **Liste d'attente** : e-mails inscrits, export CSV, suppression.

## 6. Fiche contact (.vcf)

- Format vCard 3.0, le mieux pris en charge par les carnets d'adresses iPhone et Android.
- Champs : `N`, `FN`, `TITLE` (ligne 1 et ligne 2 séparées par une virgule), `ORG`, `TEL;TYPE=CELL`, `EMAIL;TYPE=WORK`, un `URL` par réseau et par champ libre de type lien, `X-SOCIALPROFILE` pour LinkedIn et Facebook (lu par iPhone), `NOTE` pour les champs libres de type texte, `PHOTO;ENCODING=b;TYPE=JPEG` en base64.
- Photo de la fiche : 400×400, JPEG qualité 80, environ 40 Ko.
- Encodage UTF-8, réponse `text/vcard; charset=utf-8`.

## 7. Contacts reçus : traitement

1. Le formulaire est vérifié : champs obligatoires, format de l'e-mail, consentement coché, champ piège invisible vide (anti-robot), maximum 5 envois par heure et par adresse IP.
2. Le contact est enregistré en base, avec la date du consentement et la version du texte de consentement.
3. Ensuite, sans faire attendre le visiteur :
   - un e-mail est envoyé à Benjamin (nom, coordonnées, événement, lien vers l'administration) ;
   - le contact est envoyé à Folk : `POST https://api.folk.app/v1/people`, avec une clé d'accès (`Authorization: Bearer`), `firstName`, `lastName`, `emails`, `groups` (le groupe défini dans la configuration), et en description « Rencontré via carte QR, événement X, le JJ/MM/AAAA ». Le téléphone sera ajouté si l'API Folk le permet à la création ; à vérifier dans leur référence au moment du développement.
4. En cas d'échec de Folk : statut « erreur », nouvel essai toutes les 15 minutes, 5 essais au maximum, puis bouton manuel dans l'administration. Le contact n'est jamais perdu, il reste en base.

## 8. Données personnelles (RGPD et nLPD)

- Texte de consentement, à valider par Benjamin : « J'accepte que Benjamin Vallée conserve ces coordonnées pour me recontacter dans un cadre professionnel. »
- Page `/confidentialite` : responsable du traitement, finalité, durée de conservation, sous-traitants (Infomaniak pour l'hébergement, Folk pour le CRM), droits et adresse de contact.
- Durée de conservation : 3 ans après le dernier contact, en référence à la recommandation de la CNIL pour la prospection. Suppression à la main depuis l'administration en v1, pas de purge automatique.
- Aucun cookie sur les pages publiques, aucun outil de mesure d'audience externe. Le compteur de scans ne stocke pas l'adresse IP.
- La photo envoyée est réencodée, ce qui retire ses métadonnées, dont la position GPS éventuelle.

## 9. Technique

| Sujet | Choix |
|---|---|
| Langage | TypeScript, Node.js 22 LTS |
| Serveur web | Hono, pages générées côté serveur (JSX de Hono), très peu de JavaScript côté navigateur |
| Base de données | SQLite (fichier unique) avec `better-sqlite3`, migrations SQL versionnées |
| Images | `sharp` (recadrage, redimensionnement, retrait des métadonnées) |
| QR codes | bibliothèque `qrcode` (SVG et PNG), correction d'erreur niveau M |
| E-mails | `nodemailer` via le SMTP d'Infomaniak |
| Sauvegarde | chaque nuit : copie de la base (API de sauvegarde SQLite) et du dossier photos, envoyée sur un stockage compatible S3 (Infomaniak Object Storage, en Suisse), 30 jours conservés |
| Lancement | `node dist/server.js` avec un fichier de configuration `.env`. Un `Dockerfile` est fourni en plus pour un serveur qui utilise Docker |
| Tests | Vitest |

Le modèle de données est prêt pour plusieurs comptes : chaque carte, événement et contact appartient à un utilisateur.

Tables : `users`, `login_tokens`, `sessions`, `cards`, `card_links` (réseaux), `card_fields` (champs libres), `events`, `scans` (compteur), `leads`, `waitlist`.

Sécurité : cookies de session `HttpOnly`, `Secure`, `SameSite=Lax` ; jeton anti-falsification sur les formulaires d'administration ; photos limitées à 5 Mo ; limitation du nombre de tentatives sur la connexion et sur le formulaire d'échange.

## 10. Erreurs et cas limites

- Pas de photo : initiales sur la couleur d'accent, fiche contact sans photo.
- Folk injoignable : voir section 7, rien n'est perdu.
- SMTP injoignable : l'erreur est enregistrée et visible dans l'administration, le contact reste en base.
- Identifiant de carte inconnu : page 404 simple.
- Événement inconnu dans `?e=` : la carte s'affiche, le contact est rattaché à « sans événement ».

## 11. Vérification

Tests automatiques :
- génération de la fiche contact (champs, encodage, caractères accentués, photo) ;
- validation du formulaire d'échange et anti-robot ;
- routes principales sur une base de test en mémoire ;
- envoi vers Folk avec une fausse API (succès, échec, nouvel essai).

Tests sur appareils réels, avant mise en ligne (vérifications externes à Claude et à Benjamin) :
- scan avec l'appareil photo natif sur iPhone et sur Android, et import de la fiche avec photo sur les deux ;
- aperçu du lien vérifié avec le LinkedIn Post Inspector et en collant le lien dans WhatsApp ;
- signature d'e-mail affichée dans Gmail, Outlook et Apple Mail ;
- contact test arrivé dans Folk ;
- restauration d'une sauvegarde sur une machine vierge ;
- page de la carte mesurée avec Lighthouse sur mobile : performance et accessibilité à 90 ou plus.

## 12. Décisions à prendre avant la mise en ligne (pas avant le développement)

1. **Hébergement.** Le 07/10/2026, Benjamin a écarté un serveur nu faute de compétences en administration système et a retenu un serveur cloud managé Infomaniak (environ 29 €/mois). Le VPS Lite (2,70 CHF/mois) demande justement cette administration. L'application tourne sur les deux ; il faut choisir lequel.
2. **Nom de domaine** de l'application.
3. **Compte SMTP** Infomaniak pour l'envoi des e-mails.
4. **Clé d'accès Folk** et groupe de destination.
5. **Texte de consentement et page de confidentialité.**
6. **Nom commercial** du service (utile surtout pour la v2).
