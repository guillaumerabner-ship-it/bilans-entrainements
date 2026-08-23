# Déploiement smartphone Samsung

## Préparé dans l’application

- Application Web installable (PWA) avec manifeste, icône et cache hors ligne.
- Navigation principale accessible en bas de l’écran.
- Dialogues, calendrier et séries adaptés aux écrans étroits.
- Connexion Google compatible avec un domaine public HTTPS.
- Synchronisation directe avec Google Apps Script hors de `localhost`.

## Étapes de publication

1. Publier tout le contenu du dossier sur un hébergement statique HTTPS, sans omettre `manifest.webmanifest`, `service-worker.js` et le dossier `icons`.
2. Dans Google Cloud Console, ouvrir le client OAuth Web utilisé par l’application et ajouter l’origine exacte du site, par exemple `https://entrainement.example.com`, dans **Origines JavaScript autorisées**.
3. Ouvrir l’adresse publiée dans Chrome sur le Samsung et se connecter avec le compte Google autorisé.
4. Dans **Paramètres**, renseigner une seule fois l’adresse du service Apps Script et la clé privée de synchronisation, puis toucher **Tester la connexion** et **Enregistrer**.
5. Dans Chrome Android, ouvrir le menu ⋮ puis choisir **Ajouter à l’écran d’accueil** ou **Installer l’application**.

## Recette smartphone

- Recharger trois fois et vérifier que l’accueil reste fluide.
- Ouvrir Accueil, Exercices, Vidéos, Volume et Progression depuis la barre inférieure.
- Faire défiler le calendrier horizontalement et ouvrir plusieurs séances.
- Renseigner des séries et un commentaire, fermer puis rouvrir la séance.
- Tester les dialogues de création et de modification avec le clavier affiché.
- Ajouter puis lire un lien vidéo YouTube.
- Lancer **Actualiser les données** et vérifier la synchronisation ordinateur ↔ Samsung.
- Fermer Chrome, lancer l’icône installée et vérifier le mode plein écran.
