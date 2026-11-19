# Historique des poses par période (back)

Tâche #58, user story [#29 — Revoir la toile en accéléré](https://github.com/Coordination-Front-Back-M2-TP/Coordination-Front-Back-M2-TP/issues/29). Le back suit la [proposition de contrat](contrat-api.md#get-apiplacements--historique-des-poses-par-période). L'enregistrement de l'historique est décrit dans [pose-back.md](pose-back.md).

## Route `GET /api/placements`

1. Le service lit `from`, `to`, `after` et `limit` dans la requête. Une valeur hors contrat reçoit `400 INVALID_INPUT`, sans lecture de la base.
2. Le dépôt lit la table `PixelPlacement` dans l'ordre des révisions, avec une pose de plus que la page demandée.
3. Cette pose en plus dit s'il reste une page : la réponse est `{ placements, nextCursor }`, et `nextCursor` vaut `null` à la fin.

La route est publique, comme la lecture de la toile. Une pose renvoyée contient `x`, `y`, `color`, `placedAt` et `revision` : le compte et l'équipe ne sortent pas de la base.

## Ce que le lecteur du timelapse peut en faire

- **Partir du début de la toile** : appeler la route sans `from`. La première pose renvoyée est la première de la toile.
- **Rejouer** : appliquer les poses dans l'ordre reçu sur une toile vide. Une pose remplace le pixel aux mêmes coordonnées.
- **Parcourir** : tant que `nextCursor` n'est pas `null`, rappeler la route avec `after=<nextCursor>` et les mêmes autres paramètres.
- **Pause et vitesse** : elles se règlent dans le front, à partir de `placedAt`. Le back ne garde aucun état de lecture.

## Comment c'est fait

Le code est dans `back/src/placements/`, avec les trois couches de [GUIDELINES.md](../GUIDELINES.md) (section 5). La pagination suit la révision, pas un numéro de page : une pose arrivée pendant la lecture ne décale rien, elle arrive à la fin.

Il n'y a pas de migration : la route lit la table créée par la tâche #44. L'index unique sur `revision` sert le tri et la reprise après `after`.

## Points en attente

- **Contrat** : la tâche contrat de l'EPIC (#54) n'est pas faite. La section du contrat est une proposition, écrite pour livrer cette tâche : elle reste à relire par le front (#57) et le back.
- **Accès** : la lecture est publique, sans identité de joueur. À confirmer par l'équipe.
- **Taille des pages** : 500 poses par défaut, 1000 au plus. À ajuster avec le lecteur du timelapse (#57).
- **Toile de départ d'une période** : avec `from`, la route ne donne pas l'état de la toile à cette date. Le lecteur part du début, comme le demande #29.

## Vérifications

`npm test --prefix back` (`test/placements.test.js`) couvre l'historique vide, la lecture complète dans l'ordre depuis la première pose, l'absence de compte et d'équipe dans la réponse, la pose remplacée, les bornes `from` (incluse) et `to` (exclue), une date avec décalage horaire, la pagination sans trou ni doublon, la pagination dans une période, les entrées invalides et la lecture sans compte. Les tests pilotent l'horloge du serveur : ils n'attendent pas.
