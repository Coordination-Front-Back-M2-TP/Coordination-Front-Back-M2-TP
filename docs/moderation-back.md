# Modération : rôle admin, nettoyage d'une zone, journal (back)

Tâche #61, user story [#31 — Nettoyer une zone](https://github.com/Coordination-Front-Back-M2-TP/Coordination-Front-Back-M2-TP/issues/31). Les routes et événements sont décrits dans le [contrat de modération](contrat-api.md#modérer-la-toile). Le front est la tâche #60. Le bannissement (#63) est décrit dans [bannissement-back.md](bannissement-back.md).

## Routes

| Route | Succès | Erreurs |
| --- | --- | --- |
| `POST /api/moderation/cleanups` `{ fromX, fromY, toX, toY }` | `200 { action }` | `400 INVALID_INPUT`, `401 UNAUTHORIZED`, `403 FORBIDDEN` |
| `GET /api/moderation/actions` | `200 { actions, nextCursor }` | `400 INVALID_INPUT`, `401 UNAUTHORIZED`, `403 FORBIDDEN` |

Les deux routes demandent un compte admin : `401` sans session, `403` avec un compte joueur.

## Rôle admin

- **Deux rôles** : `player`, par défaut, et `admin`. Le rôle est une colonne du compte.
- **`user.role`** : `GET /api/auth/me` renvoie le rôle. Le front s'en sert pour montrer l'outil aux seuls admins.
- **Le serveur revérifie toujours** : cacher l'outil ne protège rien. Le rôle est relu dans la base à chaque requête de modération : une admin à qui on retire le rôle perd l'accès tout de suite, sans se reconnecter.
- **Aucune route ne donne le rôle.** Un `role` envoyé à l'inscription est ignoré. Le rôle se change depuis le serveur, sur un compte déjà créé :

```bash
npm run account:role --prefix back -- <pseudo> admin
```

`player` à la place d'`admin` retire le rôle. Un pseudo inconnu est refusé : le script ne crée pas de compte.

## Nettoyer une zone

- **Zone** : un rectangle donné par deux coins inclus, `(fromX, fromY)` en haut à gauche et `(toX, toY)` en bas à droite. Les coordonnées sont celles de la toile, de `-50` à `50`. Une zone peut être une seule case ou toute la toile.
- **Effet** : les pixels visibles de la zone sont supprimés. Les cases redeviennent vides.
- **En direct** : après l'enregistrement, le serveur émet `canvas:cleared` aux abonnés de la toile, avec la zone, la `revision` et l'heure. Le contrat décrit la [comparaison des révisions par case](contrat-api.md#appliquer-les-événements-de-modération).
- **Révision** : un nettoyage prend une révision de la toile, comme une pose. Une pose faite juste après garde donc une révision plus récente et reste visible.
- **Historique** : les poses de la zone restent dans `PixelPlacement`. Le nettoyage ne réécrit pas le passé.
- **Un refus ne change rien** : ni la toile, ni le journal.

## Journal

- Chaque nettoyage ajoute une ligne à la table `ModerationAction`, dans la même transaction que la suppression des pixels : l'un ne peut pas exister sans l'autre.
- Une ligne garde le type (`zone_cleanup`), le pseudo de l'admin, l'heure serveur et les détails : la zone, le nombre de pixels retirés (`removedCount`) et la révision.
- Un nettoyage d'une zone vide est noté aussi, avec `removedCount` à `0`.
- `GET /api/moderation/actions` rend les actions les plus récentes d'abord, 50 par page et 200 au plus (`limit`). `nextCursor` se passe dans `before` pour la page suivante ; il vaut `null` à la fin.
- Le journal ne se modifie pas et ne se vide pas par l'API.

## Comment c'est fait

Le code est dans `back/src/moderation/` : `moderation-routes.js`, `moderation-service.js` et `moderation-repository.js` ([GUIDELINES.md](../GUIDELINES.md), section 5). Le script du rôle est `back/scripts/set-role.js`.

La migration `add_moderation` ajoute la colonne `role` au compte et crée la table `ModerationAction`. Le champ `details` est un objet JSON, pour accueillir d'autres types d'action (le bannissement, #63) sans nouvelle colonne.

## Points en attente

- **Donner le rôle en production** : le script se lance dans le conteneur du back. La façon de faire sur le NAS reste à écrire avec la personne qui s'occupe du déploiement.
- **Timelapse** (#58) : `GET /api/placements` ne dit pas qu'une zone a été nettoyée. Le timelapse rejoue donc les poses effacées.
- **Classement** (#56) : les pixels nettoyés ne comptent plus, mais `ranking:updated` n'est pas émis après un nettoyage. À brancher quand les deux seront sur `main`.

## Vérifications

`npm test --prefix back` (`test/moderation.test.js`) couvre le rôle renvoyé avec le joueur, le rôle ignoré à l'inscription, les refus `401` et `403`, le nettoyage et ses bords, l'historique gardé, la diffusion `canvas:cleared`, la pose faite après un nettoyage, la zone vide, la case seule et la toile entière, les zones invalides, le journal et sa pagination, le rôle retiré et le script `set-role`.
