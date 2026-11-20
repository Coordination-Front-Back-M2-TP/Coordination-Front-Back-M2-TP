# Poser un pixel (front)

Tâche #43, user story [#21 — Poser un pixel](https://github.com/Coordination-Front-Back-M2-TP/Coordination-Front-Back-M2-TP/issues/21). Le front suit le [contrat de pose](contrat-api.md#post-apipixels--poser-un-pixel) de l'EPIC #42.

## Parcours

1. Le joueur choisit une couleur dans la palette (`ColorPalette`).
2. Il clique sur une case de la toile (`PixelCanvas`). Le clic est traduit en coordonnées, origine au centre, `x` vers la droite et `y` vers le bas.
3. `PixelPlacer` envoie `POST /api/pixels` avec `{ x, y, color }`, par `front/src/api/pixels.js`.
4. La réponse annonce « Pixel … posé en (x, y). » dans une zone `aria-live`. La toile se met à jour avec `pixel:updated`, que le serveur diffuse aussi au joueur qui a posé.

Au clavier, les champs « Colonne (x) » et « Ligne (y) » et le bouton « Poser le pixel » font la même pose. Une seule pose part à la fois : un double clic n'envoie pas deux requêtes.

## Délai entre deux poses

Après une pose acceptée, le compte à rebours affiche le temps avant la prochaine pose. Sa durée vient de
la différence entre `cooldownEndsAt` et `pixel.updatedAt`, deux dates fournies par le serveur. Le front
démarre le décompte à la réception de la réponse et suspend la pose sur la toile et au clavier jusqu’à
l’échéance. Le serveur contrôle toujours le délai du compte.

Après un rechargement ou une pose depuis un autre onglet, un refus `429 COOLDOWN_ACTIVE` relance le compte
à rebours à partir de `Retry-After`. Sans cet en-tête, le front affiche un message d’attente.

## Compte, équipe et historique

Le front n'envoie ni jeton, ni identifiant de compte, ni identifiant d'équipe. Le serveur les déduit de la session et les inscrit dans l'historique, avec l'heure serveur (contrat, section `POST /api/pixels`). Un test vérifie que le corps de la requête ne contient que `x`, `y` et `color`.

## Sans compte

`LiveCanvas` et `PixelPlacer` reçoivent `user` :

| Valeur | Sens | Affichage |
| --- | --- | --- |
| `undefined` | session inconnue (le front de l'authentification n'est pas encore branché) | palette et pose proposées ; le serveur tranche |
| `null` | visiteur | toile seule et « Connectez-vous pour poser un pixel. » |
| objet | joueur connecté | palette et pose |

Une réponse `401 UNAUTHORIZED` affiche aussi « Connectez-vous pour poser un pixel. ». La toile reste publique dans tous les cas.

## Erreurs

Les messages sont fixes : le texte du serveur n'est jamais affiché.

| Code | Message |
| --- | --- |
| `UNAUTHORIZED` | Connectez-vous pour poser un pixel. |
| `COOLDOWN_ACTIVE` | Compte à rebours si `Retry-After` est fourni, message d’attente sinon. |
| `INVALID_INPUT` | Cette case ou cette couleur n'est pas acceptée. |
| autre, réseau, réponse invalide | La pose a échoué. Réessayez dans un instant. |

## Points en attente d'une décision

- **Palette** : le contrat la laisse « à valider ». `front/src/api/palette.js` contient une proposition de 8 couleurs, marquée comme telle, à remplacer en un seul endroit quand l'équipe l'aura fixée avec le back.
- **Transport de la session** : le contrat #18 ne le fixe pas encore. Le front suppose un cookie géré par le serveur (`credentials: 'same-origin'`), comme la branche de l'authentification front (#38). Le placeholder du back (#44) propose plutôt l'en-tête `X-Session-Id` : tant que les deux ne sont pas alignés, la pose réelle renvoie `401`. Seul `front/src/api/pixels.js` est à modifier.
- **Branchement de `user`** : `App` ne transmet pas encore `user` à `LiveCanvas`. Le front de l'authentification (#38) le fera.

## Vérifications

`npm test --prefix front` couvre l'appel (corps, cookie, codes d'erreur, `Retry-After`, réponse invalide, coupure réseau), la traduction du clic en coordonnées jusqu'aux coins de la toile, la pose au clavier, le refus de coordonnées hors toile, l’absence de compte, les messages d’erreur, le compte à rebours après un succès ou un refus et la reprise de la pose à l’échéance.
