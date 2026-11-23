# Contrat API — découvrir la toile et dessiner à la main

> La section « découvrir la toile » reprend le contrat de l’issue #33.
> La section « dessiner à la main » est une proposition pour l’issue #42, à relire par le front et le back avant implémentation.
> Les routes et événements décrivent le contrat visé ; ils ne sont pas tous implémentés.
> Pour livrer l’issue #35, l’implémentation reprend la proposition de résolution 101 × 101 ; l’axe Y augmente vers le bas. L’instantané contient au plus les 10 201 pixels de la toile et `canvas:error` expose uniquement un code et un message. Ces choix de livraison restent révisables par l’équipe.

Ce document couvre la lecture de la toile et sa mise à jour en direct pour la user story [#15 — Voir la toile en direct](https://github.com/Coordination-Front-Back-M2-TP/Coordination-Front-Back-M2-TP/issues/15), ainsi que la pose manuelle et le délai des user stories [#21 — Poser un pixel](https://github.com/Coordination-Front-Back-M2-TP/Coordination-Front-Back-M2-TP/issues/21) et [#22 — Voir mon délai](https://github.com/Coordination-Front-Back-M2-TP/Coordination-Front-Back-M2-TP/issues/22). Les choix signalés comme propositions restent à valider par l’équipe.

## Conventions

- L’API HTTP est préfixée par `/api`. Les corps HTTP sont en JSON ; les clés sont en `camelCase`.
- La consultation de la toile et l’abonnement temps réel sont publics : aucun compte n’est nécessaire pour regarder.
- La toile fait 101 × 101 pixels. Avec une origine au centre, les coordonnées vont de `-50` à `50` sur les deux axes ; `(0, 0)` est le pixel central. Cette taille compacte s’affiche sur un écran 800 × 600 avec une marge pour les commandes.
- `x` augmente vers la droite et `y` augmente vers le bas, pour correspondre aux coordonnées écran. Les deux bornes sont inclusives ; toute coordonnée hors de `-50..50` est invalide.
- `color` est une couleur hexadécimale `#RRGGBB` appartenant à la palette du jeu (section « Palette » ci-dessous). Tout joueur pose n’importe quelle couleur de la palette : son équipe ne la limite pas.
- Les dates sont en UTC au format ISO 8601, par exemple `2026-10-27T14:30:00.000Z`.
- Les données publiques représentent uniquement l’état visuel courant de la toile. Elles ne contiennent ni historique des poses, ni pseudo, ni identifiant de compte, ni autre identité de joueur. L’historique se lit par une route à part, `GET /api/placements`, elle aussi sans identité de joueur.
- `revision` est un entier strictement croissant pour chaque changement de la toile. Le serveur l’attribue au moment où il persiste l’état ; il permet au client de distinguer les mises à jour nouvelles des événements déjà inclus dans un instantané.
- Un instantané contient au plus 10 201 pixels (un par case). Il n’y a pas de limite d’octets distincte : la taille est bornée par la résolution de la toile.

## Palette

Décidée le 20/11/2026 : 16 couleurs, ouvertes à tous les joueurs ([besoin](besoin.md), section 3). Les valeurs sont une proposition, reprise de `front/src/api/palette.js`.

| Nom | `color` | Nom | `color` |
| --- | --- | --- | --- |
| Noir | `#000000` | Jaune | `#FACC15` |
| Gris foncé | `#4B5563` | Beige | `#FDE68A` |
| Gris clair | `#9CA3AF` | Vert | `#22C55E` |
| Blanc | `#FFFFFF` | Vert foncé | `#166534` |
| Rouge | `#D93A3A` | Cyan | `#22D3EE` |
| Rose | `#F472B6` | Bleu | `#2563EB` |
| Orange | `#F59E0B` | Bleu marine | `#1E3A8A` |
| Marron | `#92400E` | Violet | `#9333EA` |

Écart connu : le back accepte aujourd’hui toute couleur `#RRGGBB`, sans vérifier qu’elle appartient à la palette.

## Modèle `Pixel`

```json
{
  "x": 12,
  "y": 8,
  "color": "#D93A3A",
  "updatedAt": "2026-10-27T14:30:00.000Z",
  "revision": 184
}
```

| Champ | Type | Signification |
| --- | --- | --- |
| `x` | entier | Coordonnée horizontale, de `-50` à `50`, avec `0` au centre |
| `y` | entier | Coordonnée verticale, de `-50` à `50`, avec `0` au centre |
| `color` | chaîne `#RRGGBB` | Couleur actuellement visible |
| `updatedAt` | date ISO 8601 | Heure à laquelle cet état du pixel a été enregistré côté serveur |
| `revision` | entier | Révision globale à laquelle cet état a été enregistré |

Le contrat ne renvoie aucune identité de joueur ni aucun historique de poses.

## HTTP

### `GET /api/pixels`

Renvoie l’état courant de la toile. Cette route est destinée aux consultations HTTP ; le client temps réel utilise l’instantané retourné par `canvas:subscribe` pour établir son abonnement sans manquer les changements.

**Succès — `200 OK`**

```json
{
  "width": 101,
  "height": 101,
  "revision": 184,
  "snapshotAt": "2026-10-27T14:30:00.000Z",
  "pixels": [
    {
      "x": 12,
      "y": 8,
      "color": "#D93A3A",
      "updatedAt": "2026-10-27T14:29:58.000Z",
      "revision": 181
    }
  ]
}
```

- `snapshotAt` est l’heure serveur de lecture de l’instantané.
- `width` et `height` sont respectivement `101` et `101` tant que la proposition de résolution n’a pas été modifiée.
- `revision` est la dernière révision incluse dans l’instantané ; chaque pixel listé a une révision inférieure ou égale à celle-ci.
- `pixels` contient au plus un état courant par coordonnée. Une toile vide renvoie `[]`.
- Le serveur renvoie uniquement les pixels présents (représentation creuse) ; l’absence d’une coordonnée dans `pixels` signifie que cette case est vide.

**Erreur — `500 Internal Server Error`**

En production, le middleware back proposé dans la PR #110 renvoie une réponse générique et ne révèle aucun détail interne :

```json
{
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "Une erreur inattendue est survenue."
  }
}
```

En développement, le middleware ajoute `stack` et, si disponibles, `details` dans l’objet `error` pour faciliter le diagnostic. Ces champs ne sont jamais renvoyés en production. La forme de base reste celle définie dans [GUIDELINES.md](../GUIDELINES.md#6-contrat-entre-le-front-et-le-back).

### `POST /api/pixels` — poser un pixel

**Proposition pour l’issue #42.** Cette route requiert un compte connecté. Le transport de la session suit le contrat d’authentification de l’issue #18 ; le client ne transmet ni identifiant de compte ni identifiant d’équipe. Le serveur déduit ces informations de la session authentifiée.

**Requête — `application/json`**

```json
{
  "x": 12,
  "y": 8,
  "color": "#D93A3A"
}
```

`x` et `y` sont des entiers compris entre `-50` et `50`, bornes incluses. `color` doit être au format `#RRGGBB` et appartenir à la palette (section « Palette »).

**Succès — `200 OK`**

```json
{
  "pixel": {
    "x": 12,
    "y": 8,
    "color": "#D93A3A",
    "updatedAt": "2026-10-27T14:30:00.000Z",
    "revision": 185
  },
  "cooldownEndsAt": "2026-10-27T14:30:10.000Z"
}
```

`pixel` est l’état canonique enregistré par le serveur. `cooldownEndsAt` est l’heure serveur à laquelle le compte pourra poser à nouveau un pixel ; le front s’en sert pour afficher le compte à rebours. La durée proposée pour la démo est de 10 secondes, réglable côté serveur ; sa valeur définitive reste à confirmer.

Chaque pose acceptée crée aussi une entrée d’historique contenant le compte identifié par la session, son équipe au moment de l’enregistrement, les coordonnées, la couleur et l’heure serveur. Un changement d’équipe enregistré avant la pose s’applique à cette pose. L’historique conserve chaque pose, y compris lorsqu’elle remplace un pixel visible. Il n’est pas renvoyé dans cette réponse ni diffusé sur la toile.

#### Erreurs

| Statut | Code | Cas |
| --- | --- | --- |
| `400 Bad Request` | `INVALID_INPUT` | Coordonnées invalides ou couleur absente, mal formée ou hors palette |
| `401 Unauthorized` | `UNAUTHORIZED` | Compte non connecté |
| `429 Too Many Requests` | `COOLDOWN_ACTIVE` | Le délai du compte n’est pas écoulé |
| `500 Internal Server Error` | `INTERNAL_SERVER_ERROR` | Erreur inattendue |

Une réponse `429` conserve le format d’erreur commun. Elle inclut l’en-tête HTTP `Retry-After`, exprimé en secondes, pour indiquer le temps restant sans faire analyser un message destiné à l’utilisateur.

### `GET /api/placements` — historique des poses par période

**Contrat de l’issue #54, écrit pour livrer la tâche #58** et relu avec la PR qui ferme #54. Cette route sert le timelapse de la user story [#29 — Revoir la toile en accéléré](https://github.com/Coordination-Front-Back-M2-TP/Coordination-Front-Back-M2-TP/issues/29). Elle est publique, comme la lecture de la toile.

**Paramètres de requête**, tous facultatifs :

| Paramètre | Type | Signification |
| --- | --- | --- |
| `from` | date ISO 8601 avec fuseau | Début de la période, inclus. Absent : depuis la première pose de la toile |
| `to` | date ISO 8601 avec fuseau | Fin de la période, exclue. Absent : jusqu’à la dernière pose |
| `after` | entier ≥ 0 | Révision de la dernière pose déjà reçue : la page commence juste après |
| `limit` | entier de `1` à `1000` | Nombre maximal de poses dans la page. `500` par défaut |

Exemple : `GET /api/placements?from=2026-10-27T14:00:00.000Z&to=2026-10-27T15:00:00.000Z&limit=2`.

**Succès — `200 OK`**

```json
{
  "placements": [
    {
      "x": 12,
      "y": 8,
      "color": "#D93A3A",
      "placedAt": "2026-10-27T14:30:00.000Z",
      "revision": 185
    },
    {
      "x": 12,
      "y": 8,
      "color": "#2F6FDE",
      "placedAt": "2026-10-27T14:30:12.000Z",
      "revision": 186
    }
  ],
  "nextCursor": 186
}
```

- `placements` contient les poses acceptées de la période, dans l’ordre croissant des révisions : c’est l’ordre dans lequel elles ont changé la toile. Chaque pose y figure, y compris celle qu’une pose suivante a remplacée.
- `placedAt` est l’heure serveur de la pose ; `revision` est celle du `Pixel` enregistré par cette pose.
- `nextCursor` est la valeur à passer dans `after` pour lire la page suivante, avec les mêmes autres paramètres. Il vaut `null` quand la période est entièrement lue.
- Une période sans pose renvoie `{ "placements": [], "nextCursor": null }`.
- Une pose de l’historique ne contient ni pseudo, ni identifiant de compte, ni équipe.

#### Erreurs de l’historique

| Statut | Code | Cas |
| --- | --- | --- |
| `400 Bad Request` | `INVALID_INPUT` | Date inexistante, mal formée ou sans fuseau, `from` égal ou postérieur à `to`, `limit` ou `after` hors bornes, paramètre répété |
| `500 Internal Server Error` | `INTERNAL_SERVER_ERROR` | Erreur inattendue |

### Flux temps réel d’une pose

Le front envoie la pose par `POST /api/pixels`. Il n’émet pas de commande de pose Socket.IO. Après validation et enregistrement réussis, le serveur diffuse le `pixel:updated` décrit plus haut à tous les abonnés de la toile, y compris le joueur à l’origine de la pose. L’ACK HTTP fournit au joueur son `cooldownEndsAt` ; aucun événement temps réel de délai n’est nécessaire.

### `GET /api/rankings` — classement des équipes

**Contrat de l’issue #54, écrit pour livrer la tâche #56** et relu avec la PR qui ferme #54. Cette route sert le podium de la user story [#28 — Voir le classement des équipes](https://github.com/Coordination-Front-Back-M2-TP/Coordination-Front-Back-M2-TP/issues/28). Elle est publique, comme la lecture de la toile, et ne prend aucun paramètre.

**Succès — `200 OK`**

```json
{
  "revision": 185,
  "teams": [
    { "teamId": "rouge", "pixelCount": 42, "rank": 1 },
    { "teamId": "bleue", "pixelCount": 17, "rank": 2 },
    { "teamId": "verte", "pixelCount": 17, "rank": 2 },
    { "teamId": "jaune", "pixelCount": 3, "rank": 4 }
  ]
}
```

| Champ | Type | Signification |
| --- | --- | --- |
| `revision` | entier | Révision de la toile au moment du calcul |
| `teams[].teamId` | chaîne | Identifiant de l’équipe, celui du contrat des équipes (#37) |
| `teams[].pixelCount` | entier ≥ 1 | Nombre de pixels visibles que l’équipe a posés en dernier |
| `teams[].rank` | entier ≥ 1 | Rang de l’équipe, `1` pour la première |

- Un pixel compte pour l’équipe qui l’a posé en dernier. Une pose remplacée ne compte plus.
- `teams` est trié par `pixelCount` décroissant. Deux équipes à égalité ont le même `rank` et le rang suivant est sauté ; entre elles, l’ordre suit `teamId`.
- Une équipe sans pixel n’apparaît pas dans `teams`. Une toile sans pose renvoie `{ "revision": 0, "teams": [] }`.
- Le classement ne donne que `teamId` : le front lit le nom et la couleur de chaque équipe avec `GET /api/teams`. Comme les joueurs créent des équipes, un `teamId` inconnu du front veut dire qu’une équipe est née depuis sa dernière lecture : il relit `GET /api/teams`.
- Le classement ne contient ni pseudo ni identifiant de compte.

En cas d’erreur inattendue, la route répond `500 INTERNAL_SERVER_ERROR` au format commun.

## Temps réel — Socket.IO

Le client se connecte au namespace Socket.IO `/`. Il peut consulter la toile sans authentification.

### Client → serveur : `canvas:subscribe`

Demande l’abonnement aux changements de la toile. Aucun payload n’est requis.

Le serveur confirme l’abonnement avec l’ACK Socket.IO et renvoie un instantané au format de `GET /api/pixels`. Il enregistre d’abord l’abonnement puis lit un instantané cohérent avec sa `revision`. Un événement peut donc arriver avant l’ACK. Le client doit le mettre en attente jusqu’à réception de l’instantané, remplacer son état par l’instantané, puis appliquer dans l’ordre les événements dont la révision est supérieure à celle de l’instantané. Les événements déjà inclus dans l’instantané sont ignorés.

Exemple de valeur de l’ACK :

```json
{
  "width": 101,
  "height": 101,
  "revision": 184,
  "snapshotAt": "2026-10-27T14:30:00.000Z",
  "pixels": [
    {
      "x": 12,
      "y": 8,
      "color": "#D93A3A",
      "updatedAt": "2026-10-27T14:29:58.000Z",
      "revision": 181
    }
  ]
}
```

Une nouvelle souscription après reconnexion renvoie un instantané complet actualisé. Le client remplace alors son état local par cet instantané et n’essaie pas de rejouer des événements reçus avant la déconnexion.

### Serveur → client : `pixel:updated`

Après l’enregistrement réussi d’un changement de pixel, le serveur émet `pixel:updated` aux clients abonnés. Le payload est le `Pixel` canonique enregistré par le serveur :

```json
{
  "x": 12,
  "y": 8,
  "color": "#D93A3A",
  "updatedAt": "2026-10-27T14:30:00.000Z",
  "revision": 185
}
```

Le client remplace l’état local à la coordonnée `(x, y)` seulement si la révision reçue est plus récente que celle déjà affichée à cet emplacement. Le serveur, et non le navigateur, est l’autorité sur l’état diffusé. Cet événement ne constitue pas une commande de pose et ne doit pas être accepté du client.

### Serveur → client : `ranking:updated`

**Contrat de l’issue #54.** Après un changement de pixel qui modifie le classement, le serveur émet `ranking:updated` aux clients abonnés à la toile par `canvas:subscribe` : il n’y a pas d’abonnement séparé. Le payload est le classement complet, au format de `GET /api/rankings` :

```json
{
  "revision": 185,
  "teams": [
    { "teamId": "rouge", "pixelCount": 42, "rank": 1 },
    { "teamId": "bleue", "pixelCount": 17, "rank": 2 },
    { "teamId": "verte", "pixelCount": 17, "rank": 2 },
    { "teamId": "jaune", "pixelCount": 3, "rank": 4 }
  ]
}
```

Le client lit d’abord `GET /api/rankings`, puis remplace son classement par chaque payload reçu dont la `revision` est supérieure à celle qu’il affiche. Un changement de pixel qui laisse le classement identique n’émet rien. Après une reconnexion, le client relit `GET /api/rankings`.

### Client → serveur : `canvas:unsubscribe`

Demande l’arrêt de l’abonnement de ce socket. Aucun payload ni réponse ne sont requis. La déconnexion ferme également l’abonnement.

### Serveur → client : `canvas:error`

Signale une erreur d’abonnement ou de lecture. Le payload proposé suit la forme de base du format commun :

```json
{
  "error": {
    "code": "BOARD_UNAVAILABLE",
    "message": "La toile est momentanément indisponible."
  }
}
```

Le gestionnaire Express de la PR #110 ne traite pas les erreurs Socket.IO. Le serveur devra donc appliquer explicitement cette forme pour `canvas:error` ; les champs de diagnostic de développement décrits pour les réponses HTTP ne sont pas inclus dans cet événement par défaut.

## Rejoindre le jeu — comptes et équipes

> **Proposition pour l’issue #37**, à relire par une personne du front et une personne du back avant implémentation. Elle couvre les user stories [#18 — Créer un compte et se connecter](https://github.com/Coordination-Front-Back-M2-TP/Coordination-Front-Back-M2-TP/issues/18) et [#19 — Rejoindre une équipe](https://github.com/Coordination-Front-Back-M2-TP/Coordination-Front-Back-M2-TP/issues/19). Les chemins des comptes reprennent ceux que le front suppose déjà dans la tâche #38.

### Session

- La session est portée par un cookie posé par le serveur, `p1x3l_session`. Le front ne lit et ne stocke aucun jeton : le navigateur renvoie le cookie tout seul, le front et l’API partageant la même origine.
- Le cookie est `HttpOnly`, `SameSite=Lax`, `Path=/`, et `Secure` en production. Sa valeur est un jeton opaque tiré au hasard ; elle ne contient ni pseudo ni identifiant de compte.
- Une session dure 30 jours, durée réglable côté serveur. Elle survit au rechargement de la page et au redémarrage du serveur. La déconnexion la supprime côté serveur.
- Une route qui demande un compte répond `401 UNAUTHORIZED` sans session valide. C’est ainsi que `POST /api/pixels` reconnaît le joueur.
- Il n’y a aucun message temps réel pour les comptes ni pour les équipes : Socket.IO reste public et ne transporte aucune identité.

### Modèle `User`

```json
{
  "pseudo": "Alex",
  "team": {
    "id": "rouge",
    "name": "Rouge",
    "color": "#D93A3A"
  }
}
```

| Champ | Type | Signification |
| --- | --- | --- |
| `pseudo` | chaîne | Pseudo du joueur, tel qu’il l’a saisi à l’inscription |
| `team` | `Team` ou `null` | Équipe du joueur ; `null` tant qu’il n’en a pas choisi |

Le modèle ne contient ni identifiant de compte, ni mot de passe, ni empreinte du mot de passe.

Règles de saisie :

- `pseudo` : de 3 à 20 caractères parmi les lettres sans accent, les chiffres, `_` et `-`. Il est unique sans tenir compte de la casse : `Alex` et `alex` sont le même pseudo.
- `password` : de 8 à 128 caractères. Il est stocké haché, jamais en clair, et n’est jamais renvoyé ni journalisé.

### `POST /api/auth/register` — créer un compte

**Requête — `application/json`**

```json
{
  "pseudo": "Alex",
  "password": "un mot de passe"
}
```

**Succès — `201 Created`**, avec le cookie de session : le joueur est connecté dès l’inscription.

```json
{
  "user": {
    "pseudo": "Alex",
    "team": null
  }
}
```

| Statut | Code | Cas |
| --- | --- | --- |
| `400 Bad Request` | `INVALID_INPUT` | Pseudo ou mot de passe absent ou hors des règles de saisie |
| `409 Conflict` | `PSEUDO_TAKEN` | Le pseudo est déjà pris |
| `500 Internal Server Error` | `INTERNAL_SERVER_ERROR` | Erreur inattendue |

### `POST /api/auth/login` — se connecter

Même corps de requête que l’inscription.

**Succès — `200 OK`**, avec le cookie de session et `{ "user": … }` au format du modèle `User`.

| Statut | Code | Cas |
| --- | --- | --- |
| `400 Bad Request` | `INVALID_INPUT` | Pseudo ou mot de passe absent, ou qui n’est pas une chaîne |
| `401 Unauthorized` | `INVALID_CREDENTIALS` | Pseudo inconnu ou mot de passe incorrect |
| `500 Internal Server Error` | `INTERNAL_SERVER_ERROR` | Erreur inattendue |

La réponse est la même pour un pseudo inconnu et pour un mot de passe incorrect : elle ne dit pas si un pseudo existe.

### `POST /api/auth/logout` — se déconnecter

Aucun corps. **Succès — `204 No Content`** : la session est supprimée côté serveur et le cookie est effacé. Sans session, la réponse est aussi `204`.

### `GET /api/auth/me` — retrouver le joueur connecté

Le front l’appelle au chargement de la page.

**Succès — `200 OK`** : `{ "user": … }` au format du modèle `User`.

**Sans session valide — `401 Unauthorized`**, code `UNAUTHORIZED` : le visiteur n’est pas connecté.

### Modèle `Team`

```json
{
  "id": "rouge",
  "name": "Rouge",
  "color": "#D93A3A"
}
```

| Champ | Type | Signification |
| --- | --- | --- |
| `id` | chaîne | Identifiant stable de l’équipe ; c’est le `teamId` du classement |
| `name` | chaîne | Nom affiché |
| `color` | chaîne `#RRGGBB` | Couleur de l’équipe |

> **Changement décidé le 20/11/2026** : le nombre d’équipes n’a plus de limite et les joueurs peuvent créer une équipe ([besoin](besoin.md), section 3). La couleur d’une équipe sert à la reconnaître ; elle ne limite pas les couleurs que ses joueurs posent. La création d’équipe est décrite plus bas (« Créer une équipe »).

Les 4 équipes de départ, livrées avec la tâche #41 :

| `id` | `name` | `color` |
| --- | --- | --- |
| `rouge` | Rouge | `#D93A3A` |
| `bleue` | Bleue | `#2F6FDE` |
| `verte` | Verte | `#2E9E4F` |
| `jaune` | Jaune | `#E5B700` |

### `GET /api/teams` — lister les équipes

Publique. **Succès — `200 OK`** : `{ "teams": [ … ] }`, toutes les équipes au format du modèle `Team` (4 aujourd’hui, sans limite une fois la création d’équipe livrée).

### `PUT /api/auth/me/team` — rejoindre ou changer d’équipe

Compte connecté requis.

**Requête — `application/json`**

```json
{
  "teamId": "rouge"
}
```

**Succès — `200 OK`**

```json
{
  "user": {
    "pseudo": "Alex",
    "team": {
      "id": "rouge",
      "name": "Rouge",
      "color": "#D93A3A"
    }
  },
  "teamChangeAvailableAt": "2026-10-27T14:35:00.000Z"
}
```

`teamChangeAvailableAt` est l’heure serveur à partir de laquelle le joueur pourra changer d’équipe. Un joueur change d’équipe au plus toutes les 5 minutes, durée réglable côté serveur. Le premier choix d’équipe n’attend pas. Demander l’équipe que l’on a déjà répond `200` sans relancer le délai.

| Statut | Code | Cas |
| --- | --- | --- |
| `400 Bad Request` | `INVALID_INPUT` | `teamId` absent ou qui n’est pas une chaîne |
| `401 Unauthorized` | `UNAUTHORIZED` | Compte non connecté |
| `404 Not Found` | `TEAM_NOT_FOUND` | Aucune équipe n’a cet identifiant |
| `429 Too Many Requests` | `TEAM_CHANGE_COOLDOWN` | Le délai de changement d’équipe n’est pas écoulé |
| `500 Internal Server Error` | `INTERNAL_SERVER_ERROR` | Erreur inattendue |

Une réponse `429` inclut l’en-tête `Retry-After`, en secondes, comme pour la pose.

Les pixels déjà posés restent à l’équipe du joueur au moment de la pose : changer d’équipe ne les déplace pas.

### Pose d’un pixel et équipe

Une équipe est obligatoire pour poser un pixel. `POST /api/pixels` répond `403 Forbidden`, code `TEAM_REQUIRED`, à un joueur connecté qui n’a pas encore choisi d’équipe ; rien n’est écrit. Ce cas s’ajoute aux erreurs de la pose décrites plus haut.

### Points à valider pour « Rejoindre le jeu »

- Code des entrées invalides : `INVALID_INPUT`, comme pour la pose. La tâche front #38 suppose `VALIDATION_ERROR` : à aligner d’un côté ou de l’autre.
- Chemins sous `/api/auth` : ils reprennent ceux de la tâche #38, alors que [GUIDELINES.md](../GUIDELINES.md) (section 3) demande des noms au pluriel. À confirmer.
- Règles du pseudo et du mot de passe, durée de la session (30 jours).
- Équipe obligatoire pour poser (`403 TEAM_REQUIRED`) : à confirmer avec le front, qui doit proposer le choix d’équipe avant la première pose.
- Limiter les essais de connexion répétés (protection contre la recherche de mot de passe) : non prévu dans cette proposition.

## Créer une équipe

> **Contrat de l’issue #157**, relu avec la PR #163. Il couvre la user story [#156 — Créer une équipe](https://github.com/Coordination-Front-Back-M2-TP/Coordination-Front-Back-M2-TP/issues/156), décidée le 20/11/2026 : le nombre d’équipes n’a pas de limite. Il sert les tâches #158 (back) et #159 (front).

### Règles

- Un joueur connecté crée une équipe avec un nom et une couleur. Il en devient membre aussitôt.
- Le nombre d’équipes n’a pas de limite. Les 4 équipes actuelles (`rouge`, `bleue`, `verte`, `jaune`) restent, comme équipes de départ. Leur `id` ne change pas : les comptes et l’historique des poses qui les citent restent valides.
- `name` : de 3 à 20 caractères après suppression des espaces au début et à la fin. Lettres (accents compris), chiffres, espaces, `_` et `-`. Deux équipes ne peuvent pas avoir le même nom, sans tenir compte de la casse ni des accents : `Les Éclairs` et `les eclairs` sont le même nom.
- `color` : une des 16 couleurs de la palette (section « Palette »). Plusieurs équipes peuvent avoir la même couleur : sans limite d’équipes, la palette ne suffirait pas. Le nom reste ce qui distingue deux équipes.
- `id` : calculé par le serveur à partir du nom, en minuscules, sans accent, les espaces et les autres caractères remplacés par `-` (`Les Éclairs` donne `les-eclairs`). Il ne change plus ensuite. Deux noms qui donnent le même `id` sont le même nom.
- Créer une équipe compte comme un changement d’équipe : le délai de `PUT /api/auth/me/team` s’applique. Le premier choix n’attend pas. Pendant le délai, rien n’est créé. Ce délai limite aussi la création d’équipes en série.
- Un joueur banni ne crée pas d’équipe.
- Une équipe vide reste : elle n’est ni supprimée ni renommée. Supprimer une équipe, la renommer ou changer sa couleur n’est pas prévu pour l’instant. Changer de couleur parmi celles de la palette pourra venir plus tard.
- Les 4 équipes de départ gardent leurs couleurs actuelles, même si elles ne sont pas dans la palette (décidé le 20/11/2026).
- Aucun message temps réel n’annonce une nouvelle équipe, comme pour les comptes. Le front relit `GET /api/teams` quand il rencontre un `teamId` inconnu (voir le classement).

### `POST /api/teams` — créer une équipe

Compte connecté requis.

**Requête — `application/json`**

```json
{
  "name": "Les Éclairs",
  "color": "#9333EA"
}
```

**Succès — `201 Created`**

```json
{
  "team": {
    "id": "les-eclairs",
    "name": "Les Éclairs",
    "color": "#9333EA"
  },
  "user": {
    "pseudo": "Alex",
    "team": {
      "id": "les-eclairs",
      "name": "Les Éclairs",
      "color": "#9333EA"
    }
  },
  "teamChangeAvailableAt": "2026-11-20T14:35:00.000Z"
}
```

`name` est renvoyé tel qu’il est enregistré, sans les espaces du début et de la fin. `color` est en majuscules. `teamChangeAvailableAt` a le même sens que pour `PUT /api/auth/me/team`.

| Statut | Code | Cas |
| --- | --- | --- |
| `400 Bad Request` | `INVALID_INPUT` | `name` ou `color` absent, pas une chaîne, nom hors règles, couleur hors palette |
| `401 Unauthorized` | `UNAUTHORIZED` | Compte non connecté |
| `403 Forbidden` | `ACCOUNT_BANNED` | Le compte est banni |
| `409 Conflict` | `TEAM_NAME_TAKEN` | Une équipe a déjà ce nom |
| `429 Too Many Requests` | `TEAM_CHANGE_COOLDOWN` | Le délai de changement d’équipe n’est pas écoulé |
| `500 Internal Server Error` | `INTERNAL_SERVER_ERROR` | Erreur inattendue |

Une réponse `429` inclut l’en-tête `Retry-After`, en secondes. En cas d’erreur, rien n’est créé et l’équipe du joueur ne change pas.

### Ce qui change pour les autres routes

- `GET /api/teams` renvoie toutes les équipes : les 4 de départ d’abord, puis les autres dans l’ordre de création. La liste n’est pas paginée pour l’instant ; une pagination s’ajoutera si elle devient trop longue.
- `PUT /api/auth/me/team` accepte l’`id` de n’importe quelle équipe, créée ou de départ. Ses erreurs ne changent pas.
- `GET /api/rankings` et `ranking:updated` ne changent pas : une nouvelle équipe y apparaît dès son premier pixel.

## Règles de cohérence et de performance

- Le serveur persiste le changement avant d’émettre `pixel:updated` ; un événement ne doit jamais annoncer une écriture qui a échoué.
- La persistance de l’état du pixel et l’attribution de sa révision sont atomiques. Deux changements distincts ne partagent pas la même révision.
- Pour chaque pose acceptée, l’enregistrement de l’historique, la mise à jour de la toile, l’attribution de la révision et le prochain délai du compte sont atomiques. Le contrôle du délai est fait côté serveur et s’applique au compte, pas à une connexion Socket.IO particulière.
- Une pose refusée ne modifie ni la toile, ni l’historique, ni le délai du compte. Le serveur émet `pixel:updated` uniquement après la persistance réussie.
- Une mise à jour reçue remplace le pixel local aux mêmes coordonnées si sa révision est plus récente. La réception du même événement à nouveau ne doit pas créer un doublon ni faire régresser l’état.
- Le client met en tampon les événements reçus avant l’ACK d’abonnement, installe l’instantané, puis applique uniquement les événements de révision supérieure. Après une reconnexion, il demande un nouvel instantané.
- L’objectif produit est qu’un changement enregistré apparaisse chez les autres joueurs en moins d’une seconde.
- Les erreurs HTTP utilisent le statut approprié et le format `error` standard. Les erreurs Socket.IO utilisent `canvas:error`.

## Modérer la toile

> **Proposition pour l’issue #59, écrite pour livrer les tâches #61 et #63.** Elle reste à relire par le front et le back. Elle couvre les user stories [#31 — Nettoyer une zone](https://github.com/Coordination-Front-Back-M2-TP/Coordination-Front-Back-M2-TP/issues/31) et [#32 — Bannir un joueur et annuler ses pixels](https://github.com/Coordination-Front-Back-M2-TP/Coordination-Front-Back-M2-TP/issues/32).

### Rôle

Le joueur connecté renvoyé par `GET /api/auth/me` porte un champ `role` : `"player"` ou `"admin"`. Le front s’en sert pour montrer l’outil de modération aux seuls admins. Le serveur revérifie le rôle à chaque requête de modération : sans session, la réponse est `401 UNAUTHORIZED` ; avec un compte joueur, `403 FORBIDDEN`. Aucune route ne donne ni ne retire le rôle.

### `POST /api/moderation/cleanups` — nettoyer une zone

Compte admin requis.

**Requête — `application/json`**

```json
{
  "fromX": 10,
  "fromY": 10,
  "toX": 12,
  "toY": 12
}
```

La zone est un rectangle donné par deux coins inclus : `(fromX, fromY)` en haut à gauche, `(toX, toY)` en bas à droite. Les quatre valeurs sont des entiers de `-50` à `50`, avec `fromX ≤ toX` et `fromY ≤ toY`.

**Succès — `200 OK`**

```json
{
  "action": {
    "id": 7,
    "type": "zone_cleanup",
    "admin": "Lea",
    "createdAt": "2026-10-27T14:30:00.000Z",
    "details": {
      "fromX": 10,
      "fromY": 10,
      "toX": 12,
      "toY": 12,
      "removedCount": 4,
      "revision": 186
    }
  }
}
```

Les pixels visibles de la zone sont supprimés : leurs cases redeviennent vides. `removedCount` est le nombre de pixels retirés, `revision` la révision de la toile prise par le nettoyage. `action` est la ligne ajoutée au journal. Une zone vide répond aussi `200`, avec `removedCount` à `0`.

| Statut | Code | Cas |
| --- | --- | --- |
| `400 Bad Request` | `INVALID_INPUT` | Coin absent, hors de `-50..50`, non entier, ou coins inversés |
| `401 Unauthorized` | `UNAUTHORIZED` | Compte non connecté |
| `403 Forbidden` | `FORBIDDEN` | Le compte n’est pas admin |
| `500 Internal Server Error` | `INTERNAL_SERVER_ERROR` | Erreur inattendue |

### Serveur → client : `canvas:cleared`

Après l’enregistrement d’un nettoyage, le serveur émet `canvas:cleared` aux clients abonnés à la toile par `canvas:subscribe` :

```json
{
  "fromX": 10,
  "fromY": 10,
  "toX": 12,
  "toY": 12,
  "revision": 186,
  "clearedAt": "2026-10-27T14:30:00.000Z"
}
```

Le client retire de son état chaque pixel de la zone dont la révision est inférieure à `revision`. Un pixel de la zone avec une révision supérieure vient d’une pose faite après le nettoyage : il reste. Comme pour `pixel:updated`, un événement reçu avant l’ACK d’abonnement est mis en attente, puis ignoré si sa révision est déjà dans l’instantané. L’événement ne contient pas le pseudo de l’admin.

### `GET /api/moderation/players` — lister les joueurs

Compte admin requis.

| Paramètre | Type | Signification |
| --- | --- | --- |
| `limit` | entier de `1` à `200` | Nombre maximal de joueurs dans la page. `50` par défaut |
| `after` | pseudo | Pseudo du dernier joueur déjà reçu : la page commence juste après |

**Succès — `200 OK`**

```json
{
  "players": [
    {
      "pseudo": "Troll",
      "team": { "id": "rouge", "name": "Rouge", "color": "#D93A3A" },
      "role": "player",
      "banned": true,
      "bannedAt": "2026-10-27T14:35:00.000Z"
    }
  ],
  "nextCursor": null
}
```

Les joueurs sont rangés par pseudo, sans tenir compte de la casse. `team` vaut `null` sans équipe, `bannedAt` vaut `null` tant que le joueur n’est pas banni. `nextCursor` se passe dans `after` pour la page suivante ; il vaut `null` à la fin de la liste. Les erreurs sont celles du journal.

### `POST /api/moderation/bans` — bannir un joueur

Compte admin requis.

**Requête — `application/json`**

```json
{
  "pseudo": "Troll"
}
```

Le pseudo se lit sans tenir compte de la casse.

**Succès — `200 OK`**

```json
{
  "action": {
    "id": 8,
    "type": "player_ban",
    "admin": "Lea",
    "createdAt": "2026-10-27T14:35:00.000Z",
    "details": {
      "pseudo": "Troll",
      "restoredCount": 12,
      "clearedCount": 3,
      "revision": 187
    }
  }
}
```

Le joueur est banni et ses pixels encore visibles sont annulés. Chaque case reprend le pixel d’avant lui, d’après l’historique des poses (`restoredCount`) ; sans pixel d’avant, elle redevient vide (`clearedCount`). Le pixel d’avant ne vient jamais d’un autre joueur banni, ni d’avant un nettoyage de la case. `action` est la ligne ajoutée au journal.

Un joueur banni garde son compte et sa session, mais il ne peut plus poser : `POST /api/pixels` répond `403 ACCOUNT_BANNED`.

| Statut | Code | Cas |
| --- | --- | --- |
| `400 Bad Request` | `INVALID_INPUT` | `pseudo` absent, vide ou qui n’est pas un texte |
| `401 Unauthorized` | `UNAUTHORIZED` | Compte non connecté |
| `403 Forbidden` | `FORBIDDEN` | Le compte n’est pas admin |
| `404 Not Found` | `PLAYER_NOT_FOUND` | Aucun compte n’a ce pseudo |
| `409 Conflict` | `ALREADY_BANNED` | Le joueur est déjà banni |
| `409 Conflict` | `ADMIN_NOT_BANNABLE` | Le compte visé est admin |
| `500 Internal Server Error` | `INTERNAL_SERVER_ERROR` | Erreur inattendue |

### Serveur → client : `canvas:reverted`

Après un bannissement qui change la toile, le serveur émet `canvas:reverted` aux clients abonnés à la toile par `canvas:subscribe` :

```json
{
  "revision": 187,
  "revertedAt": "2026-10-27T14:35:00.000Z",
  "restored": [
    { "x": 10, "y": 10, "color": "#2F6FDE", "updatedAt": "2026-10-27T14:20:00.000Z", "revision": 120 }
  ],
  "cleared": [
    { "x": 11, "y": 10 }
  ]
}
```

`restored` liste les pixels remis, au format `Pixel` : ils gardent l’heure et la révision de leur pose d’origine. `cleared` liste les cases vidées. Le client applique chaque case dont le pixel qu’il affiche a une révision inférieure à `revision` : il le remplace par le pixel de `restored`, ou le retire pour `cleared`. Une case dont le pixel a une révision supérieure vient d’une pose faite après le bannissement : elle reste. Comme pour `pixel:updated`, un événement reçu avant l’ACK d’abonnement est mis en attente, puis ignoré si sa révision est déjà dans l’instantané. L’événement ne contient ni le pseudo du joueur banni ni celui de l’admin.

### `GET /api/moderation/actions` — lire le journal

Compte admin requis.

| Paramètre | Type | Signification |
| --- | --- | --- |
| `limit` | entier de `1` à `200` | Nombre maximal d’actions dans la page. `50` par défaut |
| `before` | entier ≥ 1 | Identifiant de la dernière action déjà reçue : la page commence juste avant |

**Succès — `200 OK`** : `{ "actions": [ … ], "nextCursor": 5 }`. Les actions ont le format de `action` ci-dessus, la plus récente d’abord. `type` vaut `zone_cleanup` ou `player_ban`, et `details` dépend du type. `nextCursor` se passe dans `before` pour la page suivante ; il vaut `null` à la fin du journal.

Les erreurs sont celles du nettoyage ; `400 INVALID_INPUT` correspond ici à `limit` ou `before` hors bornes.

## Dessiner avec l’IA — demander un modèle

> Proposition pour la tâche [#47](https://github.com/Coordination-Front-Back-M2-TP/Coordination-Front-Back-M2-TP/issues/47), à relire côté front et côté back avant les tâches #48 et #49. Elle couvre l’US [#24 — Demander un modèle à l’IA](https://github.com/Coordination-Front-Back-M2-TP/Coordination-Front-Back-M2-TP/issues/24). Le quota de cinq modèles par jour est décidé dans le [besoin](besoin.md#3-règles-du-jeu). Les routes, la remise à zéro en UTC et les limites de saisie ci-dessous sont proposées.

Les deux routes utilisent le cookie de session existant et renvoient `Cache-Control: no-store`. Le serveur déduit le compte de la session. La génération et le quota se traitent en HTTP.

### `GET /api/models/quota` — consulter le quota et les services de modération

**Succès — `200 OK`**.

```json
{
  "quota": {
    "limit": 5,
    "remaining": 3,
    "resetsAt": "2026-10-28T00:00:00.000Z"
  },
  "moderationProviders": ["jev", "openai"]
}
```

`remaining` compte les générations encore disponibles, entre zéro et `limit`. `resetsAt` donne le prochain minuit UTC, au format ISO 8601. Le front lit le quota à l’ouverture du formulaire et l’affiche avant le premier envoi. Il désactive l’envoi si `remaining` vaut zéro et relit le quota à `resetsAt`. Sans session, le serveur répond `401 UNAUTHORIZED`.

`moderationProviders` énumère les services configurés côté serveur. Le formulaire permet au joueur de choisir entre « Jev » (`jev`) et « OpenAI » (`openai`) quand les deux sont proposés. Jev est présélectionné quand il est proposé. Si un seul service est proposé, le formulaire le sélectionne et l’affiche. Une liste vide rend l’envoi indisponible et le formulaire l’indique.

### `POST /api/models` — générer un modèle

**Requête — `application/json`**.

```json
{ "prompt": "Un éclair jaune et un point noir", "moderationProvider": "openai" }
```

`prompt` est une chaîne de 1 à 500 points de code Unicode après retrait des espaces de début et de fin. `moderationProvider` est obligatoire et vaut `jev` ou `openai`. L’envoi reste désactivé dans le formulaire tant que sa demande est en cours.

**Succès — `200 OK`**, avec le modèle et le quota actualisé au même format que la lecture du quota.

```json
{
  "model": {
    "width": 3,
    "height": 2,
    "pixels": [
      { "x": 1, "y": 0, "color": "#FACC15" },
      { "x": 0, "y": 1, "color": "#FACC15" },
      { "x": 2, "y": 1, "color": "#000000" }
    ]
  },
  "quota": {
    "limit": 5,
    "remaining": 2,
    "resetsAt": "2026-10-28T00:00:00.000Z"
  }
}
```

- `width` et `height` sont des entiers compris entre 1 et 32. L’origine `(0, 0)` est le coin supérieur gauche du modèle. `x` augmente à droite et `y` vers le bas.
- `pixels` contient entre 1 et `width × height` entrées. Les coordonnées sont des entiers à l’intérieur du modèle. Chaque case apparaît au plus une fois, avec une `color` au format `#RRGGBB` issue de la [palette](#palette). Les cases absentes sont transparentes.
- Le front affiche un aperçu en transparence et permet de déplacer son coin supérieur gauche `(originX, originY)` sur la toile. Il valide le placement quand le rectangle tient entièrement dans les dimensions de l’instantané. Pour une case du modèle, les coordonnées de la toile sont `(originX + x, originY + y)`. La pose manuelle et le lancement de l’agent utilisent leurs routes existantes. La génération et la validation du placement n’émettent aucun événement Socket.IO.

### Vérification de la consigne et décompte

1. Le serveur valide la session, la consigne et le service choisi, puis vérifie que le compte ne soumet qu’une génération à la fois et que son quota le permet. Le même quota s’applique aux deux services.
2. Le service choisi contrôle la consigne. Pour `jev`, le serveur utilise [Jev de TypeSafe](https://docs.typesafe.ai/cookbooks/llm_guardrails). Pour `openai`, il utilise [l’API de modération OpenAI](https://developers.openai.com/api/docs/guides/moderation). Le serveur appelle GPT pour générer la grille uniquement après une autorisation explicite du service choisi. En cas d’échec ou de refus, il arrête la demande sans appeler l’autre service. Seule la consigne est transmise comme donnée joueur. Les clés restent côté serveur.
3. GPT propose une grille. Le serveur la valide avant de débiter le quota. Un refus, une erreur fournisseur ou une grille invalide laisse le quota intact et libère la demande en cours.
4. Un modèle validé compte pour la journée UTC pendant laquelle la demande a été acceptée. Si le résultat arrive après minuit, la réponse expose le quota de la nouvelle journée. Le serveur enregistre le débit avant de répondre.

Les réponses d’erreur reprennent `{ "error": { "code": "…", "message": "…" } }`. Le front affiche un message du jeu, indépendant des réponses brutes des services.

| Statut | Code | Cas |
| --- | --- | --- |
| `400 Bad Request` | `INVALID_JSON` | Corps JSON illisible |
| `400 Bad Request` | `INVALID_INPUT` | Consigne absente ou hors des limites, ou valeur de `moderationProvider` absente ou inconnue |
| `401 Unauthorized` | `UNAUTHORIZED` | Session absente ou expirée |
| `409 Conflict` | `MODEL_REQUEST_IN_PROGRESS` | Ce compte a déjà une génération en cours |
| `422 Unprocessable Content` | `PROMPT_REJECTED` | Le service choisi refuse la consigne. Le quota reste inchangé |
| `429 Too Many Requests` | `MODEL_QUOTA_EXHAUSTED` | Le compte a épuisé son quota |
| `500 Internal Server Error` | `INTERNAL_SERVER_ERROR` | Le service choisi n’est pas configuré, le contrôle ou la génération échoue, la grille est invalide ou une erreur interne survient |

Sur `429`, l’en-tête `Retry-After` donne le nombre de secondes jusqu’à `resetsAt`, arrondi à l’entier supérieur. Le front relit alors le quota pour synchroniser son affichage. Après une réponse réseau incertaine, il relit le quota avant de réactiver l’envoi.

### Cas à vérifier dans les tâches front et back

| Cas | Résultat attendu |
| --- | --- |
| Quota à zéro lors de l’ouverture | Le formulaire affiche le quota épuisé sans envoyer de `POST` |
| Le joueur choisit l’un des deux services | Le serveur fait contrôler la consigne uniquement par ce service avant d’appeler GPT |
| Aucun service de modération n’est configuré | Le formulaire indique l’indisponibilité et désactive l’envoi |
| Jev ou OpenAI refuse une consigne | Un message explique le refus, GPT n’est pas appelé, le quota est inchangé |
| Le service choisi ou GPT échoue, ou GPT renvoie une case invalide | Le serveur ne renvoie aucun modèle et conserve le quota |
| Deux demandes concurrentes sur un compte à une génération restante, avec des services différents | Au plus une demande aboutit et le quota ne passe jamais sous zéro |
| Un modèle valide est reçu | Le quota diminue d’une unité, l’aperçu respecte les cases transparentes et se déplace jusqu’aux bords de la toile |
| Une demande finit après le changement de jour | Elle est comptée sur le jour de son acceptation et la réponse donne le quota du nouveau jour |

Le modèle GPT, le coût par appel et le protocole d’appel à Jev restent dans les [questions ouvertes](besoin.md#9-questions-ouvertes). Le [mode image](story-map.md#carte) appartient à l’US #26.

## Dessiner avec l’IA — agent de dessin

> **Proposition pour l’issue #47, écrite pour livrer la tâche #51.** Elle reste à relire par le front et le back. Elle couvre la user story [#25 — Confier le modèle à mon agent](https://github.com/Coordination-Front-Back-M2-TP/Coordination-Front-Back-M2-TP/issues/25). Le [contrat de génération](#dessiner-avec-lia--demander-un-modèle) décrit le modèle avant placement.

L’agent de dessin est un programme du serveur, sans IA. Il pose le modèle du joueur au rythme du délai de son compte, même quand le joueur est déconnecté. Les trois routes demandent un compte connecté : l’agent est toujours celui du compte de la session.

### Modèle `Agent`

```json
{
  "status": "running",
  "startedAt": "2026-10-27T14:30:00.000Z",
  "total": 3,
  "done": 1,
  "nextPlacementAt": "2026-10-27T14:30:10.000Z",
  "pixels": [
    { "x": 10, "y": 10, "color": "#D93A3A" },
    { "x": 11, "y": 10, "color": "#D93A3A" },
    { "x": 10, "y": 11, "color": "#2F6FDE" }
  ]
}
```

| Champ | Signification |
| --- | --- |
| `status` | Toujours `"running"` : un agent arrêté n’existe plus |
| `startedAt` | Heure serveur du lancement |
| `total` | Nombre de pixels du modèle |
| `done` | Nombre de pixels du modèle que la toile montre déjà, quelle que soit la personne qui les a posés |
| `nextPlacementAt` | Heure serveur prévue de la prochaine pose ; `null` quand le modèle est fini, ou avant la première pose |
| `pixels` | Le modèle, tel qu’il a été envoyé au lancement |

### `POST /api/agent` — lancer l’agent

**Requête — `application/json`**

```json
{
  "pixels": [
    { "x": 10, "y": 10, "color": "#D93A3A" },
    { "x": 11, "y": 10, "color": "#D93A3A" },
    { "x": 10, "y": 11, "color": "#2F6FDE" }
  ]
}
```

Le modèle est déjà placé : `x` et `y` sont des coordonnées de la toile, de `-50` à `50`. Il contient de 1 à 1 024 pixels, tient dans un carré de 32 × 32 cases, et ne nomme pas deux fois la même case. Une case transparente du modèle ne s’envoie pas.

**Succès — `201 Created`** : `{ "agent": Agent }`.

L’agent pose un pixel à chaque fin de délai du compte, dans l’ordre du modèle. À chaque passage, il compare le modèle et la toile et pose le premier pixel qui ne correspond pas : un pixel écrasé par une autre équipe est donc reposé. Une fois le modèle fini, l’agent reste actif et continue de le réparer, jusqu’à ce que le joueur l’arrête. Chaque pose de l’agent est une pose du compte : elle passe par l’historique, le délai et `pixel:updated`, comme une pose à la main.

| Statut | Code | Cas |
| --- | --- | --- |
| `400 Bad Request` | `INVALID_INPUT` | Modèle absent, vide, trop grand, hors de la toile, couleur invalide ou case en double |
| `401 Unauthorized` | `UNAUTHORIZED` | Compte non connecté |
| `403 Forbidden` | `TEAM_REQUIRED` | Le joueur n’a pas encore choisi d’équipe |
| `403 Forbidden` | `ACCOUNT_BANNED` | Le compte est banni |
| `409 Conflict` | `AGENT_ALREADY_ACTIVE` | Un agent travaille déjà pour ce compte : un seul modèle est actif par compte |
| `500 Internal Server Error` | `INTERNAL_SERVER_ERROR` | Erreur inattendue |

### `GET /api/agent` — suivre la progression

**Succès — `200 OK`** : `{ "agent": Agent }`, ou `{ "agent": null }` quand aucun agent ne travaille pour ce compte. Aucun événement temps réel ne porte la progression : le front relit cette route, ou compte lui-même les pixels du modèle à partir de `pixel:updated`.

### `DELETE /api/agent` — arrêter l’agent

**Succès — `204 No Content`**, même si aucun agent ne travaillait. Les pixels déjà posés restent sur la toile.

### Pose à la main pendant que l’agent travaille

Un compte, un délai : tant que l’agent du compte existe, `POST /api/pixels` répond `409 AGENT_ACTIVE`. Le joueur arrête son agent pour reposer à la main.

L’agent d’un joueur banni s’arrête de lui-même.

## Points restant à valider avant implémentation

- Le front et le back retiennent une lecture publique limitée à la résolution et à l’état visible courant des pixels, sans historique ni identité du joueur. L’historique et l’identité ne sont pas nécessaires à l’affichage de la toile et restent dans les contrats des fonctionnalités qui en ont besoin.
- Si la résolution augmente, prévoir pagination ou transfert compact dans un contrat ultérieur.
- Les choix de résolution, d’axe, de taille d’instantané et de forme de `canvas:error` ci-dessus reprennent la proposition pour livrer l’issue #35 ; ils restent modifiables par l’équipe.
- Confirmer que le payload `canvas:error` reste limité à `code` et `message`, indépendamment des détails et stacks de diagnostic HTTP en développement.
- Confirmer avec le contrat de l’issue #18 comment la session authentifiée est transmise à `POST /api/pixels`.
- Faire vérifier la palette par le back : aujourd’hui, il accepte toute couleur `#RRGGBB`.
- Fixer la durée du délai côté serveur ; 10 secondes est une proposition issue du besoin produit.
- Faire relire le contrat de pose par une personne du front et une personne du back avant de considérer #42 terminée.
- Faire relire la route `GET /api/placements` par une personne du front et une personne du back, avec le contrat de l’EPIC « Suivre la bataille » (#54) : accès public, taille des pages, nom des champs.
