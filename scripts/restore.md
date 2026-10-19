# Restaurer une sauvegarde

Les sauvegardes sont dans le compartiment S3, sous `backups/AAAA-MM-JJ/` : `carte.db` (la base) et `media.tar.gz` (les photos).

1. Arrêter l'application : `sudo systemctl stop carte-qr` (ou `docker compose stop`).
2. Télécharger les deux fichiers du jour voulu depuis l'interface Infomaniak Object Storage (ou avec `rclone copy`), dans un dossier temporaire.
3. Remplacer les données : `cp carte.db $DATA_DIR/carte.db && rm -f $DATA_DIR/carte.db-wal $DATA_DIR/carte.db-shm && tar -xzf media.tar.gz -C $DATA_DIR`.
4. Redémarrer : `sudo systemctl start carte-qr`, puis ouvrir `https://<domaine>/health` (doit afficher `ok`) et la page de votre carte.

Faites un essai de restauration sur une machine de test avant la mise en ligne : une sauvegarde jamais restaurée n'est pas une sauvegarde vérifiée.
