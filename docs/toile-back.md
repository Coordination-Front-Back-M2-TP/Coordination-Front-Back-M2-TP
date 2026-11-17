# Lecture, pose et diffusion de la toile côté back

Le back implémente la lecture publique, l’abonnement temps réel et la pose d’un pixel prévus par le [contrat de la toile](contrat-api.md). Aucun compte n’est requis pour consulter les pixels ; la pose exige une session.

## Persistance

SQLite et Prisma stockent l’état courant, un pixel au plus par coordonnée, ainsi que la révision globale. La résolution est de 101 × 101, avec des coordonnées inclusives de `-50` à `50`, l’origine au centre, `x` vers la droite et `y` vers le bas. Les pixels absents ne sont pas stockés. Chaque écriture et l’incrément de révision partagent une transaction.

La table `PixelPlacement` conserve l’historique des poses : compte, équipe, coordonnées, couleur, heure serveur et révision de chaque pose acceptée, y compris celles remplacées depuis. Cet historique n’est jamais renvoyé par l’API ni diffusé sur la toile.

En local, la base est `back/prisma/dev.db`. Les migrations se lancent avec `npm run db:migrate:deploy --prefix back`. En production, la base `file:/data/p1x3l.db` est conservée dans le volume Docker `canvas-data` ; le conteneur applique les migrations avant de démarrer.

## Lecture HTTP

`GET /api/pixels` renvoie un instantané public au format défini dans [le contrat API](contrat-api.md). Il contient au plus 10 201 pixels — un par case — et n’expose ni identité de joueur ni historique de poses. En cas d’échec de la base, le middleware commun traite l’erreur HTTP.

## Abonnement Socket.IO

À chaque `canvas:subscribe`, le serveur joint le socket à la salle avant de lire l’instantané, puis répond par l’ACK Socket.IO. Cet ordre permet au client de mettre en attente les événements qui arriveraient avant l’ACK. `canvas:unsubscribe` quitte la salle ; une déconnexion la quitte également.

Le service serveur `savePixel` valide les coordonnées et le format `#RRGGBB`, écrit l’état et sa révision en base, puis seulement après la transaction émet `pixel:updated` dans la salle. Cette méthode interne est destinée à être appelée par la future route de pose ; aucun événement de pose n’est accepté du client. `canvas:error` n’expose que `error.code` et `error.message`.

La palette de couleurs autorisée reste à fixer avec le contrat de pose (#21). Pour la lecture comme pour la pose, les couleurs sont donc validées au format `#RRGGBB` uniquement, sans restriction de palette tant qu’elle n’est pas décidée.

## Pose d’un pixel

`POST /api/pixels` applique le contrat de pose : validation des coordonnées (`-50` à `50` inclus) et de la couleur (`#RRGGBB`), refus `400 INVALID_INPUT` si l’une est invalide. Le service `placePixel` enregistre la mise à jour de la toile, l’attribution de la révision et l’entrée d’historique dans une seule transaction, puis diffuse `pixel:updated` après la persistance. La réponse renvoie le pixel canonique et `cooldownEndsAt`. Une pose refusée ne modifie ni la toile, ni l’historique, ni la révision.

### Reports documentés

- **Session mockée** : le vrai mécanisme d’authentification (contrat #18, back #39) n’existe pas encore. Le middleware TEMPORAIRE `back/src/auth/session-placeholder.js` propose de transmettre la session par l’en-tête `X-Session-Id` : toute valeur non vide donne un compte et une équipe de démonstration, son absence renvoie `401 UNAUTHORIZED`. Cette proposition de transport est à valider en revue ; elle sera remplacée par le mécanisme du contrat #18.
- **Cooldown non appliqué** : `cooldownEndsAt` est calculé avec la durée de démonstration de 10 secondes (`PIXEL_COOLDOWN_MS`, réglable côté serveur) mais n’empêche pas de poser à nouveau. Le rejet `429 COOLDOWN_ACTIVE` pendant le délai est l’issue #46.
- **Palette non restreinte** : le format `#RRGGBB` est vérifié, mais la palette autorisée n’étant pas fixée par le contrat, aucune restriction de couleurs n’est appliquée.

## Vérification

`npm test --prefix back` vérifie la lecture HTTP, l’instantané d’abonnement sans authentification, la persistance, la diffusion après écriture, la reconnexion, les révisions, la validation des pixels et la forme des erreurs Socket.IO. Pour la pose : la réponse contractuelle, la visibilité dans `GET /api/pixels`, la diffusion, l’entrée d’historique avec compte, équipe et heure serveur, les révisions qui suivent celles de la toile, les refus `400` et `401` sans modification de la toile ni de l’historique.
