# Classement des équipes (back)

Tâche #56, user story [#28 — Voir le classement des équipes](https://github.com/Coordination-Front-Back-M2-TP/Coordination-Front-Back-M2-TP/issues/28). Le back suit la [proposition de contrat](contrat-api.md#get-apirankings--classement-des-équipes). L'enregistrement des poses est décrit dans [pose-back.md](pose-back.md).

## Ce que fait le serveur

- `GET /api/rankings` renvoie `{ revision, teams }`. Chaque équipe a son `teamId`, son `pixelCount` et son `rank`. La route est publique, comme la lecture de la toile.
- Un pixel compte pour l'équipe qui l'a posé en dernier : quand une équipe repeint la case d'une autre, la première perd un pixel et la seconde en gagne un.
- Reposer sur sa propre case ne compte pas deux fois.
- Les équipes sont triées par nombre de pixels. Deux équipes à égalité ont le même rang et le rang suivant est sauté (1, 1, 3) ; entre elles, l'ordre suit `teamId`.
- Après chaque changement de pixel, le serveur recalcule le classement. S'il a changé, il émet `ranking:updated` aux abonnés de la toile, avec le même contenu que la route.
- Le classement ne contient ni pseudo ni identifiant de compte.

## Comment c'est fait

Le code est dans `back/src/rankings/`, avec les trois couches de [GUIDELINES.md](../GUIDELINES.md) (section 5).

Le classement n'a pas de table à lui. Il se lit dans ce qui existe : la révision d'un pixel visible (`Pixel`) est celle de la pose qui l'a écrit en dernier (`PixelPlacement`). Une jointure sur `revision` garde donc une pose par case, la plus récente, et le compte se fait par `teamId`. La toile a au plus 10 201 cases : le calcul reste court.

La diffusion part de `server.js`, après `pixel:updated`. Deux calculs lancés coup sur coup peuvent finir dans le désordre : le serveur n'émet jamais un classement dont la `revision` est plus ancienne que le dernier émis. Un calcul en échec est journalisé et n'annule pas la pose, déjà enregistrée.

Un pixel écrit sans joueur (un futur nettoyage de zone, #61) n'a pas de pose dans l'historique : la case n'est plus à personne.

## Points en attente

- **Contrat** : la tâche contrat de l'EPIC (#54) n'est pas faite. Les sections du contrat sont une proposition, écrite pour livrer cette tâche : elles restent à relire par le front (#55) et le back.
- **Équipes** : la tâche #41 n'est pas livrée. `teamId` est la chaîne que la session donne à la pose. Une équipe sans pixel n'apparaît pas dans le classement : le back ne connaît pas encore la liste des 4 équipes. Elle s'ajoutera avec #41.
- **Session** : tant que l'authentification (#18) n'est pas branchée, aucune pose réelle n'est acceptée : le classement est vide hors tests.
- **Fréquence** : le classement est recalculé à chaque pose. À regrouper si le nombre de poses par seconde le demande.

## Vérifications

`npm test --prefix back` (`test/rankings.test.js`) couvre le tri et les égalités, le classement vide, le compte par équipe, la case reprise par une autre équipe, la pose sur sa propre case, l'équipe qui n'a plus de pixel, l'absence d'identité de joueur, la diffusion après une pose, l'absence de rediffusion quand rien ne change, le désabonnement et le pixel écrit sans joueur.
