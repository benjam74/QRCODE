# Amendement au plan v1 (19/10/2026)

L'environnement de développement ne peut pas installer de paquets npm. Benjamin a choisi de construire sans dépendance externe, sauf `sharp`.

| Plan initial | Remplacé par |
|---|---|
| Hono + JSX | routeur maison sur `node:http`, handlers `(Request) => Response`, gabarits en chaînes échappées (`html\`\``) |
| better-sqlite3 | `node:sqlite` (`DatabaseSync`) |
| Vitest | `node:test` + `node:assert/strict` |
| Compilation tsc | exécution TypeScript native de Node 22.18+ (suppression des types) ; `tsc --noEmit` pour vérifier les types |
| qrcode | encodeur maison (mode octet, correction M, versions 1 à 15), PNG rendu par `sharp` |
| nodemailer | client SMTP maison (TLS direct port 465, STARTTLS port 587, AUTH PLAIN) |
| @aws-sdk/client-s3 | client S3 maison (signature AWS v4) |
| tar | écriture d'archive ustar maison + `node:zlib` |
| zod | validation écrite à la main |
| jsqr (tests) | OpenCV (`python3 -c "import cv2"`) pour relire les QR dans les tests |
| Lighthouse | retiré des tests automatiques, déplacé dans la recette manuelle |

Contraintes conséquentes : Node.js 22.18 ou plus sur le serveur ; les imports internes portent l'extension `.ts` ; pas d'`enum` ni de syntaxe TypeScript non effaçable.
Interfaces publiques des tâches inchangées, sauf `createApp(deps)` qui renvoie `(req: Request) => Promise<Response>` au lieu d'une instance Hono.
