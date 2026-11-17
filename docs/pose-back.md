# Poser un pixel (back)

Tâche #44, user story [#21 — Poser un pixel](https://github.com/Coordination-Front-Back-M2-TP/Coordination-Front-Back-M2-TP/issues/21). Le back suit le [contrat de pose](contrat-api.md#post-apipixels--poser-un-pixel). Le front est décrit dans [pose-front.md](pose-front.md).

## Route `POST /api/pixels`

1. `resolvePlayer(req)` lit la session et renvoie `{ accountId, teamId }`, ou `null`. Sans joueur : `401 UNAUTHORIZED`, rien n'est écrit.
2. Le service vérifie `x` et `y` (entiers de `-50` à `50`) et `color` (`#RRGGBB`). Sinon : `400 INVALID_INPUT`. Seuls `x`, `y` et `color` sont lus dans le corps : un `accountId` ou un `teamId` envoyé par le client est ignoré. La couleur est enregistrée en majuscules.
3. Une seule transaction incrémente la révision, met à jour le pixel visible et ajoute une ligne à l'historique.
4. Après la transaction, `pixel:updated` est diffusé à la toile. La réponse est `{ pixel, cooldownEndsAt }`.

## Historique

La table `PixelPlacement` garde chaque pose acceptée, même quand elle remplace un pixel : coordonnées, couleur, `accountId`, `teamId`, `placedAt` (heure serveur, égale au `updatedAt` du pixel) et `revision`. Elle n'est exposée par aucune route. `accountId` et `teamId` sont des chaînes sans clé étrangère, en attendant les tables des comptes et des équipes.

## Points en attente

- **Session** : l'authentification (#18) n'est pas livrée. Par défaut, `resolvePlayer` renvoie toujours `null` : en l'état, toute pose réelle reçoit `401`. L'authentification passera sa propre fonction à `createApp` / `createCanvasServer`. Le transport (cookie ou en-tête) reste à aligner avec le front, voir [pose-front.md](pose-front.md).
- **Palette** : le contrat la laisse « à valider ». Le back ne contrôle que le format `#RRGGBB` ; le contrôle « hors palette » s'ajoutera dans `canvas-service.js` quand l'équipe l'aura fixée.
- **Délai** : relève de #22. En attendant, `cooldownEndsAt` vaut l'heure de la pose (aucun délai) et aucun `429` n'est renvoyé.

## Vérifications

`npm test --prefix back` (`test/pose.test.js`) couvre la pose par un joueur connecté, la diffusion, l'inscription dans l'historique avec le compte, l'équipe et l'heure, les champs d'identité ignorés dans le corps, le remplacement d'un pixel, le refus sans compte, les entrées invalides et les coins de la toile. Les tests utilisent une session factice (en-tête `x-test-account`), qui n'existe pas dans l'application.
