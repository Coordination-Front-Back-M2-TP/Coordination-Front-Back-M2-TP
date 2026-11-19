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
- `color` est une couleur hexadécimale `#RRGGBB` appartenant à la palette du jeu. La palette exacte reste à valider.
- Les dates sont en UTC au format ISO 8601, par exemple `2026-10-27T14:30:00.000Z`.
- Les données publiques représentent uniquement l’état visuel courant de la toile. Elles ne contiennent ni historique des poses, ni pseudo, ni identifiant de compte, ni autre identité de joueur. L’historique se lit par une route à part, `GET /api/placements`, elle aussi sans identité de joueur.
- `revision` est un entier strictement croissant pour chaque changement de la toile. Le serveur l’attribue au moment où il persiste l’état ; il permet au client de distinguer les mises à jour nouvelles des événements déjà inclus dans un instantané.
- Un instantané contient au plus 10 201 pixels (un par case). Il n’y a pas de limite d’octets distincte : la taille est bornée par la résolution de la toile.

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

`x` et `y` sont des entiers compris entre `-50` et `50`, bornes incluses. `color` doit être au format `#RRGGBB` et appartenir à la palette autorisée. La palette exacte reste à valider.

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

Chaque pose acceptée crée aussi une entrée d’historique contenant le compte et l’équipe issus de la session, les coordonnées, la couleur et l’heure serveur. L’historique conserve chaque pose, y compris lorsqu’elle remplace un pixel visible ; il n’est pas renvoyé dans cette réponse ni diffusé sur la toile.

#### Erreurs

| Statut | Code | Cas |
| --- | --- | --- |
| `400 Bad Request` | `INVALID_INPUT` | Coordonnées invalides ou couleur absente, mal formée ou hors palette |
| `401 Unauthorized` | `UNAUTHORIZED` | Compte non connecté |
| `429 Too Many Requests` | `COOLDOWN_ACTIVE` | Le délai du compte n’est pas écoulé |
| `500 Internal Server Error` | `INTERNAL_SERVER_ERROR` | Erreur inattendue |

Une réponse `429` conserve le format d’erreur commun. Elle inclut l’en-tête HTTP `Retry-After`, exprimé en secondes, pour indiquer le temps restant sans faire analyser un message destiné à l’utilisateur.

### `GET /api/placements` — historique des poses par période

**Proposition pour l’issue #54, écrite pour livrer la tâche #58.** Elle reste à relire par le front et le back. Cette route sert le timelapse de la user story [#29 — Revoir la toile en accéléré](https://github.com/Coordination-Front-Back-M2-TP/Coordination-Front-Back-M2-TP/issues/29). Elle est publique, comme la lecture de la toile.

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
| `400 Bad Request` | `INVALID_INPUT` | Date mal formée ou sans fuseau, `from` égal ou postérieur à `to`, `limit` ou `after` hors bornes, paramètre répété |
| `500 Internal Server Error` | `INTERNAL_SERVER_ERROR` | Erreur inattendue |

### Flux temps réel d’une pose

Le front envoie la pose par `POST /api/pixels`. Il n’émet pas de commande de pose Socket.IO. Après validation et enregistrement réussis, le serveur diffuse le `pixel:updated` décrit plus haut à tous les abonnés de la toile, y compris le joueur à l’origine de la pose. L’ACK HTTP fournit au joueur son `cooldownEndsAt` ; aucun événement temps réel de délai n’est nécessaire.

### `GET /api/rankings` — classement des équipes

**Proposition pour l’issue #54, écrite pour livrer la tâche #56.** Elle reste à relire par le front et le back. Cette route sert le podium de la user story [#28 — Voir le classement des équipes](https://github.com/Coordination-Front-Back-M2-TP/Coordination-Front-Back-M2-TP/issues/28). Elle est publique, comme la lecture de la toile, et ne prend aucun paramètre.

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
- Une équipe sans pixel n’apparaît pas dans `teams`. Une toile sans pose renvoie `{ "revision": 0, "teams": [] }`. Ce point sera revu avec la liste des équipes (#41).
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

**Proposition pour l’issue #54.** Après un changement de pixel qui modifie le classement, le serveur émet `ranking:updated` aux clients abonnés à la toile par `canvas:subscribe` : il n’y a pas d’abonnement séparé. Le payload est le classement complet, au format de `GET /api/rankings` :

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

Il y a 4 équipes de couleur. Proposition retenue pour livrer la tâche #41, à valider par l’équipe :

| `id` | `name` | `color` |
| --- | --- | --- |
| `rouge` | Rouge | `#D93A3A` |
| `bleue` | Bleue | `#2F6FDE` |
| `verte` | Verte | `#2E9E4F` |
| `jaune` | Jaune | `#E5B700` |

### `GET /api/teams` — lister les équipes

Publique. **Succès — `200 OK`** : `{ "teams": [ … ] }`, les 4 équipes au format du modèle `Team`.

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
- Noms et couleurs des 4 équipes : la proposition ci-dessus reste à valider.
- Équipe obligatoire pour poser (`403 TEAM_REQUIRED`) : à confirmer avec le front, qui doit proposer le choix d’équipe avant la première pose.
- Limiter les essais de connexion répétés (protection contre la recherche de mot de passe) : non prévu dans cette proposition.

## Règles de cohérence et de performance

- Le serveur persiste le changement avant d’émettre `pixel:updated` ; un événement ne doit jamais annoncer une écriture qui a échoué.
- La persistance de l’état du pixel et l’attribution de sa révision sont atomiques. Deux changements distincts ne partagent pas la même révision.
- Pour chaque pose acceptée, l’enregistrement de l’historique, la mise à jour de la toile, l’attribution de la révision et le prochain délai du compte sont atomiques. Le contrôle du délai est fait côté serveur et s’applique au compte, pas à une connexion Socket.IO particulière.
- Une pose refusée ne modifie ni la toile, ni l’historique, ni le délai du compte. Le serveur émet `pixel:updated` uniquement après la persistance réussie.
- Une mise à jour reçue remplace le pixel local aux mêmes coordonnées si sa révision est plus récente. La réception du même événement à nouveau ne doit pas créer un doublon ni faire régresser l’état.
- Le client met en tampon les événements reçus avant l’ACK d’abonnement, installe l’instantané, puis applique uniquement les événements de révision supérieure. Après une reconnexion, il demande un nouvel instantané.
- L’objectif produit est qu’un changement enregistré apparaisse chez les autres joueurs en moins d’une seconde.
- Les erreurs HTTP utilisent le statut approprié et le format `error` standard. Les erreurs Socket.IO utilisent `canvas:error`.

## Points restant à valider avant implémentation

- Le format de couleur `#RRGGBB` est celui du pixel transmis. La palette autorisée reste à fixer dans le contrat de pose de pixel (#21).
- Le front et le back retiennent une lecture publique limitée à la résolution et à l’état visible courant des pixels, sans historique ni identité du joueur. L’historique et l’identité ne sont pas nécessaires à l’affichage de la toile et restent dans les contrats des fonctionnalités qui en ont besoin.
- Si la résolution augmente, prévoir pagination ou transfert compact dans un contrat ultérieur.
- Les choix de résolution, d’axe, de taille d’instantané et de forme de `canvas:error` ci-dessus reprennent la proposition pour livrer l’issue #35 ; ils restent modifiables par l’équipe.
- Confirmer que le payload `canvas:error` reste limité à `code` et `message`, indépendamment des détails et stacks de diagnostic HTTP en développement.
- Confirmer avec le contrat de l’issue #18 comment la session authentifiée est transmise à `POST /api/pixels`.
- Faire relire `GET /api/rankings` et `ranking:updated` par une personne du front et une personne du back, avec le contrat de l’EPIC « Suivre la bataille » (#54) : nom des champs, règle des égalités, équipes sans pixel, diffusion aux abonnés de la toile.
- Fixer la palette autorisée et la durée du délai côté serveur ; 10 secondes est une proposition issue du besoin produit.
- Faire relire le contrat de pose par une personne du front et une personne du back avant de considérer #42 terminée.
- Faire relire la route `GET /api/placements` par une personne du front et une personne du back, avec le contrat de l’EPIC « Suivre la bataille » (#54) : accès public, taille des pages, nom des champs.
