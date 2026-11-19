# Équipes (back)

Tâche #41, user story [#19 — Rejoindre une équipe](https://github.com/Coordination-Front-Back-M2-TP/Coordination-Front-Back-M2-TP/issues/19). Le back suit la proposition de contrat de la tâche #37, section « Rejoindre le jeu » de [contrat-api.md](contrat-api.md). Les comptes et la session sont décrits dans [comptes-back.md](comptes-back.md). Le front est la tâche #40.

## Routes

| Route | Succès | Erreurs |
| --- | --- | --- |
| `GET /api/teams` | `200 { teams }`, les 4 équipes | Aucune : la route est publique |
| `PUT /api/auth/me/team` `{ teamId }` | `200 { user, teamChangeAvailableAt }` | `400 INVALID_INPUT`, `401 UNAUTHORIZED`, `404 TEAM_NOT_FOUND`, `429 TEAM_CHANGE_COOLDOWN` |

Une équipe vaut `{ id, name, color }`. `user.team` est l'équipe du joueur, ou `null` tant qu'il n'en a pas choisi : `GET /api/auth/me` la renvoie, pour l'afficher à côté du pseudo.

## Les 4 équipes

| `id` | `name` | `color` |
| --- | --- | --- |
| `rouge` | Rouge | `#D93A3A` |
| `bleue` | Bleue | `#2F6FDE` |
| `verte` | Verte | `#2E9E4F` |
| `jaune` | Jaune | `#E5B700` |

Elles sont écrites dans `back/src/teams/team-catalog.js`, sans table en base. C'est une proposition, retenue pour livrer la tâche : les noms et les couleurs restent à valider par l'équipe. L'`id` est écrit dans les comptes et dans l'historique des poses : le changer demande une migration.

## Ce que fait le serveur

- **Choisir une équipe** : le joueur connecté envoie `teamId`. Son premier choix passe sans attendre.
- **Changer d'équipe** : au plus une fois toutes les 5 minutes. Un changement trop tôt reçoit `429 TEAM_CHANGE_COOLDOWN` avec l'en-tête `Retry-After`, en secondes entières arrondies au-dessus. Le joueur garde alors son équipe.
- **`teamChangeAvailableAt`** : l'heure serveur à partir de laquelle le joueur pourra changer. Le front s'en sert sans calculer le délai lui-même.
- **Redemander son équipe** répond `200` sans relancer le délai.
- **Un refus ne lance pas de délai** : équipe inconnue (`404`), requête mal formée (`400`), pas de session (`401`).
- **Deux changements simultanés** : la condition du délai est dans la requête d'écriture. Un seul passe, l'autre reçoit `429`.

## Pose d'un pixel

- **Équipe obligatoire** : un joueur connecté sans équipe reçoit `403 TEAM_REQUIRED` et rien n'est écrit. Chaque pixel compte ainsi pour une équipe.
- **Mes pixels comptent pour mon équipe** : la pose est inscrite dans l'historique avec l'équipe du joueur à ce moment-là.
- **Changer d'équipe ne déplace pas les pixels** : les poses déjà faites restent à l'ancienne équipe.

## Comment c'est fait

Le code est dans `back/src/teams/` : `team-routes.js`, `team-service.js`, `team-repository.js` ([GUIDELINES.md](../GUIDELINES.md), section 5) et `team-catalog.js` (la liste des équipes).

La migration `add_account_team` ajoute deux colonnes au compte : `teamId` et `teamChangedAt`, l'heure du dernier changement. Le délai se calcule à partir de cette heure.

## Régler le délai

| Variable | Valeur par défaut | Rôle |
| --- | --- | --- |
| `TEAM_CHANGE_COOLDOWN_SECONDS` | `300` | Délai entre deux changements d'équipe d'un compte, en secondes. `0` le désactive. |

Une valeur absente, vide, négative ou illisible donne la valeur par défaut. Les 5 minutes réglables sont décidées dans [besoin.md](besoin.md).

## Points en attente

- **Contrat** : la tâche #37 est en relecture. `403 TEAM_REQUIRED` et la liste des équipes y sont reportés.
- **Noms et couleurs des équipes** : à valider par l'équipe.
- **Classement** (#56) : une équipe sans pixel n'y apparaît pas encore. La liste des équipes permet maintenant de l'ajouter.
- **Délai après rechargement de la page** : `teamChangeAvailableAt` n'est renvoyé qu'après un choix d'équipe. Le front le retrouve en redemandant son équipe, ou par `Retry-After` après un refus.

## Vérifications

`npm test --prefix back` (`test/teams.test.js`) couvre la liste des 4 équipes, le joueur sans équipe, le premier choix, l'équipe renvoyée avec le joueur connecté, le refus avant 5 minutes avec `Retry-After`, le changement après le délai, la même équipe redemandée, deux changements simultanés, le délai par joueur, l'absence de session, l'équipe inconnue, les requêtes mal formées, la pose refusée sans équipe, l'équipe inscrite dans l'historique et `TEAM_CHANGE_COOLDOWN_SECONDS`.
