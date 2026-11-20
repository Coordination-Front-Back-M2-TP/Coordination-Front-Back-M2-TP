# Lecture et diffusion de la toile côté back

Le back implémente la lecture publique et l’abonnement temps réel prévus par le [contrat de la toile](contrat-api.md). Aucun compte n’est requis pour consulter les pixels. La pose d’un pixel est décrite dans [pose-back.md](pose-back.md).

## Persistance

SQLite et Prisma stockent l’état courant, un pixel au plus par coordonnée, ainsi que la révision globale. La résolution est de 101 × 101, avec des coordonnées inclusives de `-50` à `50`, l’origine au centre, `x` vers la droite et `y` vers le bas. Les pixels absents ne sont pas stockés. Chaque écriture et l’incrément de révision partagent une transaction.

En local, la base est `back/prisma/dev.db`. Les migrations se lancent avec `npm run db:migrate:deploy --prefix back`. En production, la base `file:/data/p1x3l.db` est conservée dans le volume Docker `canvas-data` ; le conteneur applique les migrations avant de démarrer.

## Lecture HTTP

`GET /api/pixels` renvoie un instantané public au format défini dans [le contrat API](contrat-api.md). Il contient au plus 10 201 pixels — un par case — et n’expose ni identité de joueur ni historique de poses. En cas d’échec de la base, le middleware commun traite l’erreur HTTP.

## Abonnement Socket.IO

À chaque `canvas:subscribe`, le serveur joint le socket à la salle avant de lire l’instantané, puis répond par l’ACK Socket.IO. Cet ordre permet au client de mettre en attente les événements qui arriveraient avant l’ACK. `canvas:unsubscribe` quitte la salle ; une déconnexion la quitte également.

Le service serveur `savePixel` valide les coordonnées et le format `#RRGGBB`, écrit l’état et sa révision en base, puis seulement après la transaction émet `pixel:updated` dans la salle. Elle est appelée par la route `POST /api/pixels` ; aucun événement de pose n’est accepté du client. `canvas:error` n’expose que `error.code` et `error.message`.

La palette de couleurs autorisée reste à fixer avec le contrat de pose (#21). Pour la lecture, les couleurs sont validées au format `#RRGGBB`.

## Vérification

`npm test --prefix back` vérifie la lecture HTTP, l’instantané d’abonnement sans authentification, la persistance, la diffusion après écriture, la reconnexion, les révisions, la validation des pixels et la forme des erreurs Socket.IO.
