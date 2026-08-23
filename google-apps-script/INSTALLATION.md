# Installation du service partagé

1. Ouvrir le classeur **Test appli — Bilans d’entraînements**.
2. Aller dans **Extensions → Apps Script**.
3. Remplacer le contenu de `Code.gs` par celui du fichier `Code.gs` de ce dossier.
4. Enregistrer, choisir `initializeAppBackend`, puis cliquer sur **Exécuter**.
5. Accepter les autorisations Google. Le script crée uniquement `APP_EXERCISES`, `APP_SESSIONS`, `APP_PROGRESS`, `APP_VIDEOS` et `APP_SETTINGS`.
6. Dans le journal d’exécution, copier la clé affichée après « Clé à copier dans l’application ». La fonction `displayAppApiToken` permet de la réafficher plus tard.
7. Cliquer sur **Déployer → Nouveau déploiement → Application Web**.
8. Choisir **Exécuter en tant que : Moi** et **Qui a accès : Tout le monde**.
9. Déployer et copier l’URL terminant par `/exec`.
10. Dans l’application, ouvrir **Paramètres → Données partagées**, puis coller l’URL et la clé.

Au premier test réussi, l’application copie aussi en arrière-plan les séances, séries, vidéos et exercices déjà présents sur cet appareil. Les synchronisations suivantes n’envoient que les changements.

Ne jamais installer ce script dans le classeur original.
