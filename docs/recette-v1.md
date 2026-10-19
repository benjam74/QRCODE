# Recette v1 : vérifications sur appareils réels

À faire avant de diffuser la carte. Chaque ligne se coche quand le résultat obtenu correspond au résultat attendu.

## Scan et fiche contact
- [ ] **iPhone, appareil photo natif** : scanner le QR code imprimé. Attendu : la carte s'ouvre en moins de 2 secondes en 4G.
- [ ] **iPhone** : toucher « Enregistrer le contact ». Attendu : la fiche s'ouvre avec photo, nom, fonction sur une ligne, société, téléphone, e-mail, LinkedIn ; « Créer un contact » l'enregistre.
- [ ] **Android (Chrome), appareil photo ou Google Lens** : même scan. Attendu : la carte s'ouvre.
- [ ] **Android** : « Enregistrer le contact ». Attendu : le fichier .vcf se télécharge puis s'ouvre dans Contacts avec la photo. (Comportement variable selon les marques : noter le modèle testé.)
- [ ] **Android** : le bouton « Choisir ma fiche dans mes contacts » apparaît et remplit le formulaire.
- [ ] **QR code d'événement** : scanner le QR d'un événement, laisser ses coordonnées. Attendu : le contact porte le nom de l'événement dans l'administration et dans Folk.

## Échange de coordonnées
- [ ] Envoyer le formulaire depuis un téléphone. Attendu : page « Merci », e-mail reçu en moins d'une minute, contact présent dans Folk dans le bon groupe avec la description « Rencontré via carte QR… ».
- [ ] Envoyer sans cocher la case. Attendu : message « Cochez la case… », saisie conservée.

## Aperçus de lien
- [ ] Coller le lien de la carte dans WhatsApp. Attendu : aperçu avec photo, nom et fonction.
- [ ] Vérifier le lien dans le LinkedIn Post Inspector (https://www.linkedin.com/post-inspector/). Attendu : titre, description et image corrects.

## Signature d'e-mail
- [ ] Copier la signature depuis « Partager » et la coller dans Gmail, Outlook et Apple Mail. Attendu : photo, nom, fonction, lien « Ma carte de visite » cliquable et petit QR code affichés ; s'envoyer un e-mail de test et l'ouvrir sur téléphone.

## Administration
- [ ] Demander un lien de connexion. Attendu : e-mail reçu, le bouton « Me connecter » ouvre l'administration.
- [ ] Changer l'adresse de la carte, puis scanner un ancien QR code. Attendu : la nouvelle carte s'ouvre.
- [ ] Envoyer une photo prise à l'iPhone en portrait. Attendu : photo droite (pas tournée), recadrage respecté.

## Exploitation
- [ ] Le lendemain de la mise en ligne : deux fichiers présents dans le stockage S3 sous `backups/AAAA-MM-JJ/`.
- [ ] Restaurer cette sauvegarde sur une machine de test en suivant `scripts/restore.md`. Attendu : la carte et les contacts sont là.
- [ ] Mesurer la page de la carte avec Lighthouse (Chrome, onglet Lighthouse, mode mobile). Attendu : performance et accessibilité à 90 ou plus.
