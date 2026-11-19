# Comptes et session (back)

Tâche #39, user story [#18 — Créer un compte et se connecter](https://github.com/Coordination-Front-Back-M2-TP/Coordination-Front-Back-M2-TP/issues/18). Le back suit la proposition de contrat de la tâche #37, section « Rejoindre le jeu » de [contrat-api.md](contrat-api.md). Le front est la tâche #38.

## Routes

| Route | Succès | Erreurs |
| --- | --- | --- |
| `POST /api/auth/register` `{ pseudo, password }` | `201 { user }`, cookie de session | `400 INVALID_INPUT`, `409 PSEUDO_TAKEN` |
| `POST /api/auth/login` `{ pseudo, password }` | `200 { user }`, cookie de session | `400 INVALID_INPUT`, `401 INVALID_CREDENTIALS` |
| `POST /api/auth/logout` | `204`, cookie effacé | Aucune : sans session, `204` aussi |
| `GET /api/auth/me` | `200 { user }` | `401 UNAUTHORIZED` |

`user` vaut `{ pseudo, team }`. `team` est l'équipe du joueur, ou `null` tant qu'il n'en a pas choisi : voir [equipes-back.md](equipes-back.md). Aucune réponse ne contient d'identifiant de compte, de mot de passe ou d'empreinte.

## Ce que fait le serveur

- **Pseudo unique** : de 3 à 20 caractères parmi les lettres sans accent, les chiffres, `_` et `-`. L'unicité ne tient pas compte de la casse : la colonne `pseudoKey` (le pseudo en minuscules) porte une contrainte d'unicité dans la base. Deux inscriptions simultanées ne peuvent donc pas passer toutes les deux.
- **Mot de passe haché** : de 8 à 128 caractères. Il est haché avec scrypt (module `node:crypto`, sans dépendance) et un sel tiré au hasard pour chaque compte. La base garde `scrypt$coût$bloc$parallélisme$sel$empreinte`, jamais le mot de passe. La comparaison se fait à temps constant.
- **Connexion** : un pseudo inconnu et un mot de passe faux reçoivent la même réponse `401 INVALID_CREDENTIALS`, dans le même temps de calcul. La réponse ne dit pas si un pseudo existe.
- **Session** : un jeton de 32 octets tiré au hasard, envoyé dans le cookie `p1x3l_session`. La base n'en garde que l'empreinte SHA-256 : une copie de la base ne permet pas de reprendre une session.
- **Cookie** : `HttpOnly`, `SameSite=Lax`, `Path=/`, avec une date d'expiration. Il est `Secure` quand `NODE_ENV` vaut `production`, ce que fait l'image Docker de production.
- **Rester connecté** : la session est dans la base. Elle survit au rechargement de la page et au redémarrage du back. Le front la retrouve avec `GET /api/auth/me`.
- **Déconnexion** : la session est supprimée de la base et le cookie est effacé. Les autres sessions du compte (un autre appareil) restent ouvertes.
- **Expiration** : une session expirée n'est plus reconnue. Elle est supprimée à sa première lecture, et les sessions expirées d'un compte le sont à sa connexion suivante.

## Pose d'un pixel

`POST /api/pixels` lit maintenant le joueur dans la session : sans cookie valide, la réponse reste `401 UNAUTHORIZED`. L'historique reçoit l'identifiant du compte. Le délai entre deux poses s'applique à ce compte.

Une équipe est obligatoire pour poser : sans équipe, la réponse est `403 TEAM_REQUIRED` ([equipes-back.md](equipes-back.md)). La colonne `PixelPlacement.teamId` reste facultative dans la base, pour les poses enregistrées avant l'arrivée des équipes.

## Comment c'est fait

Le code est dans `back/src/accounts/` : `account-routes.js`, `account-service.js` et `account-repository.js` ([GUIDELINES.md](../GUIDELINES.md), section 5), plus `password.js` (hachage) et `session-cookie.js` (lecture et écriture du cookie).

La migration `create_accounts` crée les tables `Account` et `Session`. Supprimer un compte supprime ses sessions.

## Régler la durée de la session

| Variable | Valeur par défaut | Rôle |
| --- | --- | --- |
| `SESSION_TTL_DAYS` | `30` | Durée d'une session, en jours. |

Une valeur absente, vide, nulle, négative ou illisible donne la valeur par défaut. Les 30 jours sont la proposition du contrat : la durée définitive reste à confirmer par l'équipe.

## Points en attente

- **Contrat** : la tâche #37 est en relecture. Si le contrat change (chemins, codes, règles de saisie), le back suit.
- **Code des entrées invalides** : le back renvoie `INVALID_INPUT`, comme pour la pose. Le front de la tâche #38 attend `VALIDATION_ERROR` : à aligner.
- **Essais de connexion répétés** : rien ne limite le nombre d'essais. À ajouter avant une ouverture au public.
- **Historique** : `PixelPlacement.accountId` reste un texte sans clé étrangère vers `Account`.

## Vérifications

`npm test --prefix back` (`test/accounts.test.js`) couvre l'inscription et son cookie, le mot de passe haché avec son sel, le jeton absent de la base, le pseudo unique sans la casse, deux inscriptions simultanées, les entrées invalides, la connexion, la réponse identique pour un pseudo inconnu et un mot de passe faux, l'absence de session, la session après un redémarrage, la déconnexion, plusieurs appareils, l'expiration, la pose avec et sans session, les champs en trop, le cookie `Secure` en production et `SESSION_TTL_DAYS`.
