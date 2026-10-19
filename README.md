# Carte QR

Carte de visite numérique partagée par QR code, avec récupération des coordonnées des personnes rencontrées (e-mail + Folk).

- La personne scanne le QR code : la carte s'ouvre, elle enregistre votre fiche (avec photo) en un geste.
- Elle peut vous laisser ses coordonnées avec son consentement : vous recevez un e-mail et le contact arrive dans Folk.
- Un QR code par événement pour savoir où vous avez rencontré qui.
- Administration par lien de connexion envoyé par e-mail, sans mot de passe.

Spécification : `docs/superpowers/specs/2026-10-19-carte-qr-design.md`. Recette avant diffusion : `docs/recette-v1.md`.

## Prérequis

- Node.js **22.18 ou plus** (exécute le TypeScript directement, sans compilation).
- Un nom de domaine en HTTPS devant l'application (reverse proxy).
- Un compte SMTP (Infomaniak : `mail.infomaniak.com`, port 465).
- Facultatif : une clé d'API Folk et l'identifiant du groupe de destination ; un compartiment S3 (Infomaniak Object Storage) pour les sauvegardes, fortement recommandé.

Seule dépendance : `sharp` (traitement des photos). Le serveur web, la base SQLite, les QR codes, l'envoi d'e-mails et la sauvegarde S3 utilisent Node.js seul.

## Configuration

Copier `.env.example` en `.env` et le remplir. Toutes les variables y sont commentées. Générer `SESSION_SECRET` avec `openssl rand -hex 32`.

Au premier démarrage, l'application crée le compte `ADMIN_EMAIL` et une carte à l'adresse `/c/<prénom-nom>` tirée de `OWNER_NAME`. Connectez-vous ensuite sur `/admin` pour la remplir.

## Lancer sans Docker (serveur cloud managé, VPS)

```bash
npm install --omit=dev
npm start
```

Exemple d'unité systemd (`/etc/systemd/system/carte-qr.service`) :

```ini
[Unit]
Description=Carte QR
After=network.target

[Service]
WorkingDirectory=/srv/carte-qr
ExecStart=/usr/bin/node --disable-warning=ExperimentalWarning src/server.ts
Restart=always
User=carte
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Puis `sudo systemctl enable --now carte-qr`.

## Lancer avec Docker

```bash
docker build -t carte-qr .
docker run -d --name carte-qr --restart unless-stopped -p 127.0.0.1:3000:3000 --env-file .env -e DATA_DIR=/data -v carte-data:/data carte-qr
```

## HTTPS (exemple Caddy)

```
carte.exemple.ch {
  reverse_proxy 127.0.0.1:3000
}
```

L'application écoute sur `127.0.0.1` par défaut (variable `HOST`) : seul le reverse proxy l'atteint. Elle lit l'adresse du visiteur dans `X-Forwarded-For` en faisant confiance à `TRUST_PROXY_HOPS` proxys (1 par défaut) pour limiter les envois abusifs (20 contacts acceptés par heure et par adresse).

## Sauvegardes

Avec les variables `S3_*` renseignées, l'application envoie chaque nuit à 3 h (heure de Paris) la base et les photos sous `backups/AAAA-MM-JJ/`, et garde 30 jours. En cas d'échec, un e-mail part vers `ADMIN_EMAIL`. Restauration : `scripts/restore.md`.

## Développement

```bash
npm test          # tests unitaires et d'intégration (node:test)
npm run test:e2e  # tests navigateur (Playwright)
npm run typecheck # vérification des types (TypeScript)
npm run dev       # serveur avec rechargement
```

Les tests de QR code relisent les codes générés avec OpenCV (`python3 -c "import cv2"`).
