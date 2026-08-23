# Todo — Bilans d’entraînements

Dernière mise à jour : 23 août 2026

Ce fichier est la liste de référence du projet. Après chaque évolution, déplacer ou actualiser les éléments concernés afin de conserver une vue fidèle de ce qui fonctionne et de ce qui reste à faire.

## En cours

- [x] **PRIORITÉ HAUTE — Implémenter la synchronisation fiable des onglets mensuels « MOIS 2026 »** avec des identifiants de séance stables et une priorité limitée aux champs réellement saisis dans l’application.
- [x] Redéployer le schéma 5 du service Google Apps Script.
- [x] Valider en conditions réelles l’ingestion du commentaire élève depuis un onglet mensuel vers `APP_PROGRESS` : « Test App 2 Infos élève » du 23 août 2026 a été écrit puis relu dans les lignes 9, 10 et 11. La consigne coach « Test Sync » reste également validée.
- [x] Corriger les anciennes lignes `APP_SESSIONS` sans liste de champs modifiés afin qu’une consigne vide historique ne masque plus la valeur actuelle de « Infos coach » dans les onglets mensuels.
- [x] Optimiser le bouton « Actualiser les données » : charger au maximum deux onglets mensuels simultanément et ne calculer la liste des séances qu’une fois par rendu du calendrier.
- [ ] **PRIORITÉ HAUTE — Activer le bouton « Voir tout » du journal** et créer une page dédiée à l’historique complet des séances.
- [ ] Sur cette page, distinguer clairement les séances terminées, partielles, commencées, manquées et les jours de repos validés.
- [ ] Ajouter une vue de la régularité dans le temps afin d’identifier facilement les périodes suivies, les interruptions et les séances loupées.
- [x] **PRIORITÉ HAUTE — Simplifier la section « Mes exercices » de la page d’accueil** : l’accueil affiche désormais quatre exercices récemment travaillés.
- [x] Créer une page dédiée à la bibliothèque complète, avec recherche et filtres par famille et métrique.
- [x] Conserver sur la page dédiée les actions progression, vidéos, modification, archivage et création.
- [x] **PRIORITÉ HAUTE — Créer une page dédiée « Tous mes exercices »** accessible depuis l’extrait de l’accueil, avec toute la taxonomie, les familles, sous-catégories et métriques de la golden source.
- [x] Conserver sur la page « Tous mes exercices » les actions `Voir la progression`, `Vidéos`, `Modifier`, `Archiver` et `Créer un exercice`.
- [x] Ajouter sur la page « Tous mes exercices » une recherche et des filtres par famille, sous-catégorie, niveau et métrique.
- [x] Ne plus construire la liste complète des exercices lorsque seule la page d’accueil est affichée, et regrouper les rendus déclenchés par les synchronisations afin d’éviter les gels de Chrome.
- [x] Réduire les blocages restants : analyser les onglets mensuels par lots avec restitution régulière de la main au navigateur, dédupliquer les séances en temps linéaire, mémoriser les tris et options de filtres, et temporiser la recherche de la bibliothèque.
- [ ] Valider sur plusieurs rechargements que l’accueil reste fluide après une synchronisation Google Sheet.
- [x] Activer et valider le filtrage serveur par utilisateur et par élève dans les espaces élève et coach.
- [x] Déployer le schéma 4 et valider la connexion au service différentiel, le cache Google et les marqueurs de suppression vidéo.
- [x] Redéployer la protection « dernière modification gagnante ».
- [x] Effectuer le test volontaire de conflit sur deux fenêtres connectées : « Test récent » a été conservé et affiché dans les deux fenêtres.
- [x] Activer le schéma 2 et `APP_SESSIONS` dans le déploiement Google.
- [x] L’application attend désormais une confirmation positive de Google avant de retirer une écriture de sa file d’attente.
- [x] Remplacer les appels CORS incompatibles avec Google Apps Script par un pont iframe sécurisé pour les lectures et les écritures (à activer au prochain déploiement).
- [x] Ajouter un relais local même origine pour supprimer définitivement les erreurs CORS pendant le développement sur `localhost`.
- [x] Activer le schéma 3 : `APP_USERS`, `APP_COACH_STUDENTS` et les identifiants élève dans les données métier. Service déployé vérifié avec `schema: 3`.

## Fait

- [x] Corriger l’ouverture des paramètres après l’ajout de la console coach en distinguant le bouton élève du bouton de déconnexion coach.
- [x] Conserver la connexion Google lors d’un simple rechargement de la page, avec nouvelle vérification du compte côté serveur et déconnexion explicite toujours disponible.
- [x] Dupliquer une séance vers une autre date en copiant son programme, ses consignes, sa durée et son énergie prévue, sans copier les résultats ni les vidéos.
- [x] Synchroniser les séries, répétitions et commentaires dans `APP_PROGRESS`.
- [x] Synchroniser les liens vidéo dans `APP_VIDEOS`.
- [x] Synchroniser la création et la modification des exercices dans `APP_EXERCISES`.
- [x] Conserver les saisies localement lorsque la connexion Internet est indisponible.
- [x] Prévoir une file d’attente pour renvoyer les changements après reconnexion.
- [x] Connecter et valider le service Google Apps Script avec une clé privée.
- [x] Préparer `APP_SESSIONS` et le code de synchronisation des créations, modifications et suppressions de séances.
- [x] Vérifier la syntaxe de l’application et du service Google.
- [x] Vérifier la réponse du service, la clé et la connexion depuis Chrome.

## À activer ou terminer immédiatement

- [x] Recopier la dernière version de `google-apps-script/Code.gs` dans Apps Script.
- [x] Relancer `initializeAppBackend` afin de créer `APP_SESSIONS` et passer le schéma en version 2.
- [x] Publier une nouvelle version du déploiement Web Apps Script.
- [x] Recharger l’application et vérifier que la connexion aux données partagées fonctionne.

## Synchronisation et intégrité des données

- [x] Définir la priorité en cas de conflit : une donnée explicitement saisie dans l’application prime sur la donnée du tableau mensuel pour le même champ ; en l’absence de saisie dans l’application, la valeur à jour du tableau est utilisée.
- [x] Appliquer et tester localement cette priorité champ par champ pour les séries, commentaires, consignes et propriétés de séance, sans masquer les autres mises à jour provenant du tableau.
- [ ] Terminer la validation de bout en bout des onglets « MOIS 2026 » : le commentaire élève vers `APP_PROGRESS` et la consigne coach sont validés ; il reste à tester une modification de série et de structure de séance.
- [x] Lire automatiquement les onglets mensuels référencés dans `INDEX`, au démarrage, au retour sur l’application et toutes les quinze minutes.
- [x] Considérer les valeurs numériques renseignées sous les exercices des onglets mensuels comme des séries réalisées pour le calendrier, le journal, les volumes, les progressions et les trophées.
- [ ] Décider si les séances créées dans l’application doivent aussi modifier visuellement les cases des onglets mensuels, ou si `APP_SESSIONS` reste leur source dédiée.
- [x] Remplacer la suppression d’un exercice par un archivage synchronisé qui conserve les associations historiques. Création, archivage et restauration validés sur le service déployé.
- [x] Utiliser les dates « Modifié le » pour résoudre les modifications simultanées entre plusieurs appareils : le service refuse désormais une écriture plus ancienne et l’application recharge la version gagnante.
- [x] Fiabiliser la confirmation des écritures et ne retirer une opération de la file d’attente qu’après confirmation réelle de Google. Validation réelle à effectuer après le prochain déploiement.
- [x] Ajouter une actualisation partagée périodique discrète toutes les quinze minutes pour qu’un appareil ouvert récupère les changements sans rechargement manuel.
- [x] Lors de la suppression d’une séance, la retirer des vues actives tout en archivant sa fiche et en conservant ses progressions, commentaires et vidéos associés.
- [ ] Continuer à harmoniser les libellés inconnus du tableau avec la taxonomie officielle des exercices.
- [x] Empêcher l’envoi des cinq séances de démonstration historiques dans `APP_SESSIONS`.

## Coach, vidéos et sécurité

- [x] Ajouter une page de connexion Google réelle et identifier chaque utilisateur dans `APP_USERS` sans exposer la clé technique Apps Script. Comptes élève et coach validés.
- [x] Préparer trois niveaux de données : utilisateur, rôle (`élève` ou `coach`) et relation coach–élève (à activer avec le schéma 3).
- [x] Préparer un identifiant élève dans les séances, progressions, exercices personnels, vidéos et commentaires afin d’isoler correctement les données (à activer avec le schéma 3).
- [x] Créer et valider l’interface coach dédiée : liste des élèves à gauche, tableau de synthèse et console de pilotage au centre.
- [x] Permettre au coach d’ouvrir le calendrier de l’élève sélectionné et de créer, modifier ou programmer ses séances.
- [x] Ajouter des rôles distincts pour Guillaume et le coach dans l’interface et la base d’utilisateurs.
- [ ] Permettre au coach de valider une vidéo, demander une correction et écrire un commentaire de revue. Bouton de validation et retrait immédiat du flux de l’élève terminés ; persistance multi-appareil à valider après redéploiement.
- [ ] Ajouter des filtres pour afficher les vidéos non revues, validées ou à refaire.
- [ ] Ajouter un fil de feedback par séance et par exercice, visible par l’élève et le coach.
- [ ] Décider si l’envoi direct de fichiers vidéo depuis le téléphone est nécessaire, en complément des liens YouTube non répertoriés.
- [ ] Prévoir une procédure simple pour révoquer et renouveler la clé privée.
- [ ] Conserver la configuration privée séparément sur chaque navigateur ou concevoir ultérieurement une authentification utilisateur.

## Performances

- [x] Afficher immédiatement les données locales et restaurer l’interface avant la vérification Google en arrière-plan.
- [x] Faire en sorte que « Actualiser les données » envoie la file locale puis recharge aussi les données techniques partagées avant d’actualiser les onglets mensuels.
- [x] Lors d’une actualisation manuelle multi-appareil, ignorer les marqueurs différentiels locaux et demander un snapshot partagé complet.
- [x] Regrouper les demandes de snapshot concurrentes avec un délai anti-doublon d’une minute.
- [x] Mettre en cache la vérification du jeton Google pendant cinq minutes côté Apps Script.
- [x] Ajouter une révision de données et une synchronisation différentielle fondée sur « Modifié le ».
- [x] Conserver l’actualisation du Google Sheet toutes les quinze minutes sans bloquer l’interface.
- [x] Alimenter `APP_SESSIONS` et `APP_PROGRESS` par lots après la lecture des onglets mensuels, en préservant les champs explicitement saisis dans l’application et en isolant les lignes par élève.
- [x] Fiabiliser cette ingestion lorsque `APP_PROGRESS` dépasse sa taille initiale, écrire par lots de 500 lignes et afficher clairement les erreurs ou une ancienne version du service Apps Script.
- [x] Ajouter un déclencheur `onEdit` lié au classeur : une saisie dans « Infos élève » d’un onglet mensuel crée ou actualise immédiatement les lignes correspondantes dans `APP_PROGRESS`, sans dépendre de l’ouverture de l’application.
- [x] Rendre ce déclencheur installable et diagnosticable depuis le menu du classeur, avec une synchronisation manuelle de la cellule sélectionnée et un statut `LAST_MONTHLY_EDIT_SYNC` dans `APP_SETTINGS`.
- [x] Faire lire au déclencheur les exercices directement dans le bloc mensuel lorsque les lignes `APP_PROGRESS` n’existent pas encore, et compter explicitement les lignes écrites dans le diagnostic.
- [x] Faire de la commande manuelle « Synchroniser la cellule sélectionnée » une reprise forcée depuis l’onglet mensuel, afin de pouvoir retirer un ancien marqueur `commentTouched` qui bloquait volontairement la valeur du tableau.
- [x] Remplacer l’écriture groupée ambiguë du test mensuel par des écritures directes sur les lignes `APP_PROGRESS`, puis relire immédiatement les cellules et consigner leurs numéros dans `LAST_MONTHLY_EDIT_SYNC`.
- [x] Limiter la lecture de « Infos élève » au bloc hebdomadaire courant afin de ne pas concaténer le libellé du bloc suivant au commentaire.
- [ ] Paginer ou filtrer les données téléchargées lorsque l’historique couvrira plusieurs années.
- [ ] Optimiser les recherches et écritures Apps Script pour éviter les parcours ligne par ligne sur une base volumineuse.
- [ ] Surveiller le poids des historiques de progression, vidéos et séances lors des futurs tests de charge.

## Tests à effectuer après activation de `APP_SESSIONS`

- [x] Créer une séance technique temporaire et vérifier sa ligne dans `APP_SESSIONS`.
- [x] Récupérer une séance partagée dans une fenêtre privée simulant un deuxième appareil.
- [x] Modifier la séance depuis le deuxième navigateur et vérifier la date enregistrée dans Google.
- [x] Vérifier côté service qu’une séance supprimée disparaît et transmet un marqueur de suppression. Validation sur un deuxième appareil encore à faire.
- [x] Modifier une séance serveur coupé, puis vérifier sa conservation locale et son envoi automatique après reconnexion.
- [ ] Vérifier la cohérence du calendrier, du journal, des volumes, des progressions et des trophées après synchronisation.
- [ ] Tester l’ajout et la suppression de vidéos sur deux appareils.
- [x] Tester un conflit de modification volontaire entre deux appareils : la version possédant la date « Modifié le » la plus récente gagne correctement.
- [ ] Produire un nouveau rapport fonctionnel après ces essais.

## Publication et smartphone

- [x] Préparer l’application Web installable : manifeste, icône, service worker, navigation mobile persistante et dialogues adaptés aux écrans Samsung.
- [x] Permettre la connexion Google sur un domaine HTTPS public via le pont Apps Script sécurisé, sans dépendre du relais `localhost`.
- [x] Redéployer Apps Script avec le pont public envoyant sa réponse à la fenêtre principale (`top.postMessage`), puis valider la connexion GitHub Pages.
- [x] Héberger `index.html`, `styles.css` et `app.js` sur Internet avec GitHub Pages et un déploiement automatique GitHub Actions.
- [x] Ouvrir et configurer l’application depuis un smartphone Samsung : connexion Google, clé privée et synchronisation validées.
- [ ] Vérifier l’affichage, les dialogues, le calendrier, les séries horizontales et les lecteurs vidéo sur petit écran.
- [ ] Ajouter l’application à l’écran d’accueil comme application Web.
- [ ] Tester la synchronisation ordinateur ↔ smartphone.
