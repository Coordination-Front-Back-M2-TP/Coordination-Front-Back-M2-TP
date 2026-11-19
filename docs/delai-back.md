# Délai entre deux poses (back)

Tâche #46, user story [#22 — Voir mon délai](https://github.com/Coordination-Front-Back-M2-TP/Coordination-Front-Back-M2-TP/issues/22). Le back suit le [contrat de pose](contrat-api.md#post-apipixels--poser-un-pixel). La pose elle-même est décrite dans [pose-back.md](pose-back.md).

## Ce que fait le serveur

- Le délai porte sur le compte de la session, pas sur une case ni sur une connexion.
- Une pose acceptée répond `{ pixel, cooldownEndsAt }`. `cooldownEndsAt` est l'heure serveur de la pose plus le délai : le front s'en sert pour le compte à rebours, sans calculer le délai lui-même.
- Une pose envoyée avant `cooldownEndsAt` reçoit `429 COOLDOWN_ACTIVE`, au format d'erreur commun, avec l'en-tête `Retry-After`.
- `Retry-After` est le temps restant en secondes entières, arrondi au-dessus : 6,5 secondes restantes donnent `7`.
- Une pose refusée ne change rien : ni la toile, ni l'historique, ni la révision, ni le délai. Aucun `pixel:updated` n'est diffusé.
- Une pose invalide (`400`) ou sans compte (`401`) ne déclenche pas de délai.

## Comment c'est fait

Le délai n'a pas de table à lui. Il se lit dans l'historique `PixelPlacement` : la dernière pose du compte, plus la durée du délai. L'index `(accountId, placedAt)` sert cette lecture.

Le contrôle se fait dans la transaction de la pose (`canvas-repository.js`), après l'écriture de la révision. Cette écriture prend le verrou de SQLite : deux poses simultanées du même compte passent l'une après l'autre, et la seconde est refusée. Un refus annule la transaction, donc la révision n'avance pas.

## Régler la durée

| Variable | Valeur par défaut | Rôle |
| --- | --- | --- |
| `PIXEL_COOLDOWN_SECONDS` | `10` | Délai entre deux poses d'un compte, en secondes. `0` le désactive. |

Une valeur absente, vide, négative ou illisible donne la valeur par défaut. Les 10 secondes sont la proposition du contrat pour la démo : la durée définitive reste à confirmer par l'équipe.

## Points en attente

- **Session** : comme pour la pose, le délai ne s'applique à de vraies requêtes qu'une fois l'authentification (#18) branchée.
- **Délai après rechargement de la page** : le contrat ne prévoit pas de route pour relire son délai. Le front ne connaît `cooldownEndsAt` qu'après une pose acceptée, ou `Retry-After` après un refus. À décider avec le front (#45).

## Vérifications

`npm test --prefix back` (`test/cooldown.test.js`) couvre la valeur de `cooldownEndsAt`, le refus pendant le délai avec `Retry-After`, l'absence d'écriture et de diffusion après un refus, la pose de nouveau possible à l'échéance, le délai par compte, la pose invalide sans délai, deux poses simultanées du même compte et la lecture de `PIXEL_COOLDOWN_SECONDS`. Les tests pilotent l'horloge du serveur : ils n'attendent pas.
