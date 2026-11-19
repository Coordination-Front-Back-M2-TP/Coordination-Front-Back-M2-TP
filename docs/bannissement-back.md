# Modération : bannissement et annulation des poses (back)

Tâche #63, user story [#32 — Bannir un joueur et annuler ses pixels](https://github.com/Coordination-Front-Back-M2-TP/Coordination-Front-Back-M2-TP/issues/32). Le back suit la [proposition de contrat](contrat-api.md#modérer-la-toile). Le rôle admin, le nettoyage et le journal sont décrits dans [moderation-back.md](moderation-back.md). Le front est la tâche #62.

## Routes

| Route | Succès | Erreurs |
| --- | --- | --- |
| `GET /api/moderation/players` | `200 { players, nextCursor }` | `400 INVALID_INPUT`, `401 UNAUTHORIZED`, `403 FORBIDDEN` |
| `POST /api/moderation/bans` `{ pseudo }` | `200 { action }` | `400 INVALID_INPUT`, `401 UNAUTHORIZED`, `403 FORBIDDEN`, `404 PLAYER_NOT_FOUND`, `409 ALREADY_BANNED`, `409 ADMIN_NOT_BANNABLE` |

Les deux routes demandent un compte admin : `401` sans session, `403` avec un compte joueur.

## Liste des joueurs

- Un joueur est montré avec son pseudo, son équipe, son rôle, `banned` et `bannedAt`. L'identifiant du compte et l'empreinte du mot de passe ne sortent jamais.
- La liste est rangée par pseudo, sans tenir compte de la casse, 50 par page et 200 au plus (`limit`). `nextCursor` se passe dans `after` pour la page suivante ; il vaut `null` à la fin.
- Le joueur se désigne par son pseudo, unique sans tenir compte de la casse : c'est ce pseudo que le front envoie pour bannir.

## Bannir

- **Compte** : le bannissement écrit l'heure dans la colonne `bannedAt` du compte. Le compte et ses sessions restent : le joueur peut encore se connecter et regarder la toile.
- **Pose refusée** : `POST /api/pixels` répond `403 ACCOUNT_BANNED`. Rien n'est écrit : ni toile, ni historique, ni révision.
- **Un compte admin ne se bannit pas** (`409 ADMIN_NOT_BANNABLE`), donc une admin ne peut pas se bannir elle-même. Il faut d'abord retirer le rôle.
- **Un refus ne change rien** : ni le compte, ni la toile, ni le journal.

## Annuler les poses

Le bannissement annule les pixels du joueur encore visibles, dans la même transaction.

- **Quels pixels** : un pixel visible porte la révision de la pose qui l'a mis là. Les pixels du joueur sont ceux dont la révision est celle d'une de ses poses. Une case où un autre joueur a reposé après lui n'est pas touchée.
- **Le pixel d'avant** : pour chaque case, c'est la pose la plus récente d'un compte non banni, lue dans l'historique (`PixelPlacement`). La case reprend sa couleur, son heure et sa révision : le pixel reste rattaché à cette pose, donc à son joueur et à son équipe.
- **Case vide** : sans pose d'avant, la case redevient vide. C'est aussi le cas quand la case a été nettoyée après la pose d'avant : elle était vide quand le joueur banni y a posé.
- **Jamais un autre banni** : la pose d'avant ne vient pas d'un autre compte banni. Bannir deux trolls l'un après l'autre ne fait pas réapparaître les pixels du premier.
- **Historique** : les poses du joueur restent dans `PixelPlacement`. Le bannissement ne réécrit pas le passé.
- **Révision** : un bannissement prend une révision de la toile, comme une pose. Les pixels remis gardent leur révision d'origine, plus ancienne.

## En direct

Quand le bannissement change la toile, le serveur émet `canvas:reverted` aux abonnés : `revision`, `revertedAt`, les pixels remis (`restored`) et les cases vidées (`cleared`). Le front applique chaque case dont le pixel affiché a une révision plus ancienne que `revision`. L'événement ne dit pas qui est banni.

## Pose et bannissement en même temps

Le bannissement et la pose prennent le même verrou d'écriture de SQLite, et la pose relit `bannedAt` sous ce verrou. Une pose envoyée pendant un bannissement passe donc entièrement avant, et elle est annulée avec les autres, ou entièrement après, et elle est refusée. Aucun pixel du joueur ne peut rester.

## Journal

Chaque bannissement ajoute une ligne `player_ban` à `ModerationAction`, dans la même transaction. Ses détails gardent le pseudo du joueur, le nombre de pixels remis (`restoredCount`), le nombre de cases vidées (`clearedCount`) et la révision. `GET /api/moderation/actions` la rend avec les nettoyages.

## Comment c'est fait

Le code est dans `back/src/moderation/` (`banPlayer` et `listPlayers`). Le refus de la pose est dans `back/src/canvas/canvas-repository.js`.

La migration `add_account_ban` ajoute la colonne `bannedAt` au compte et un index sur `PixelPlacement(x, y, revision)`, pour retrouver la pose d'avant sur une case.

## Points en attente

- **Contrat** : la tâche contrat de l'EPIC (#59) n'est pas faite. Les routes, l'événement `canvas:reverted` et les codes d'erreur sont une proposition : à relire par le front (#62) et le back.
- **Agent** : un joueur banni ne peut plus lancer d'agent, et son agent s'arrête. C'est fait par la tâche #51 : voir [agent-back.md](agent-back.md).
- **Lever un bannissement** : aucune route ne le fait, la user story ne le demande pas. Un bannissement fait par erreur se corrige dans la base, et les pixels annulés ne reviennent pas.
- **Pixels sans historique** : un pixel posé avant l'arrivée de l'historique n'a pas de ligne dans `PixelPlacement`. Si le joueur banni a posé dessus, la case redevient vide.
- **Timelapse** (#58) : `GET /api/placements` rend encore les poses du joueur banni.
- **Classement** (#56) : les pixels remis comptent de nouveau pour leur équipe, mais `ranking:updated` n'est pas émis après un bannissement. À brancher quand les deux seront sur `main`.

## Vérifications

`npm test --prefix back` (`test/bans.test.js`) couvre les refus `401` et `403`, le pixel d'avant remis, la case vidée, la case reprise par un autre joueur, l'historique gardé, la ligne du journal, la pose refusée, la diffusion `canvas:reverted`, le pixel d'avant d'un autre banni, la case nettoyée, le pixel remis puis retiré, les refus `400`, `404` et `409`, la liste des joueurs et sa pagination.
