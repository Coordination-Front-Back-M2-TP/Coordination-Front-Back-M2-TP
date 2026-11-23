# Équipes (back)

La tâche #41 permet de rejoindre une équipe ; la tâche [#158](https://github.com/Coordination-Front-Back-M2-TP/Coordination-Front-Back-M2-TP/issues/158) ajoute leur création selon le [contrat](contrat-api.md). Les comptes et les sessions sont décrits dans [comptes-back.md](comptes-back.md).

## Routes

| Route | Succès | Principaux refus |
| --- | --- | --- |
| `GET /api/teams` | `200 { teams }`, lecture publique dans l'ordre de création | `500` |
| `POST /api/teams` | `201 { team, user, teamChangeAvailableAt }` | `400 INVALID_INPUT`, `401 UNAUTHORIZED`, `403 ACCOUNT_BANNED`, `409 TEAM_NAME_TAKEN`, `429 TEAM_CHANGE_COOLDOWN` |
| `PUT /api/auth/me/team` | `200 { user, teamChangeAvailableAt }` | `400 INVALID_INPUT`, `401 UNAUTHORIZED`, `404 TEAM_NOT_FOUND`, `429 TEAM_CHANGE_COOLDOWN` |

La création prend un nom de 3 à 20 caractères et une couleur de la palette. Les noms sont uniques sans tenir compte des accents, de la casse et des caractères ramenés à un même identifiant. Les couleurs peuvent être partagées. Le créateur rejoint l'équipe et le délai de changement s'applique. Une équipe vide reste dans la liste. Le contrat détaille les caractères admis et les erreurs.

## Persistance et cohérence

La migration `create_teams` crée la table `Team` et y inscrit les quatre équipes de départ, avec leurs identifiants et couleurs d'origine. Elle ne modifie ni les comptes, ni les sessions, ni l'historique des poses : les identifiants déjà enregistrés restent valides. Les nouvelles équipes sont ajoutées après les quatre premières.

La création et le changement d'équipe du compte sont réalisés dans une transaction. La condition de délai et l'absence de bannissement sont vérifiées lors de l'écriture ; une collision de nom annule la transaction. La contrainte unique sur l'identifiant départage les créations simultanées. La couleur d'équipe ne restreint pas la couleur d'un pixel. Le classement utilise toujours l'équipe enregistrée au moment de la pose, et une équipe apparaît dès son premier pixel visible.

La réponse de création reflète l'équipe et le délai enregistrés dans cette transaction, même si le joueur change d'équipe juste après avec un délai désactivé.

Le code est dans `back/src/teams/`, avec les accès aux équipes des comptes et de la modération dans leurs dépôts respectifs. `TEAM_CHANGE_COOLDOWN_SECONDS` règle le délai en secondes : `300` par défaut, `0` pour le désactiver. Une valeur absente, vide, négative ou illisible utilise la valeur par défaut.

Sur la page de jeu, le choix et la création d’équipe partagent un décompte. Il démarre à partir de `teamChangeAvailableAt` après une réussite, ou de `Retry-After` si le serveur refuse une demande. Après un rechargement, le serveur continue d’appliquer le délai et la première demande refusée rétablit le décompte.

## Vérifications

`npm test --prefix back` couvre notamment les équipes de départ, la création et le classement, le délai, les validations, le bannissement, les conflits et les créations simultanées.
