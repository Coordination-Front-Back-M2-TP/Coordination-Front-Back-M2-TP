# Contrat API — découvrir la toile

> Pour livrer l’issue #35, l’implémentation reprend la proposition de résolution 101 × 101 ; l’axe Y augmente vers le bas. L’instantané contient au plus les 10 201 pixels de la toile et `canvas:error` expose uniquement un code et un message. Ces choix de livraison restent révisables par l’équipe.

Ce contrat couvre la lecture de la toile et sa mise à jour en direct pour la user story [#15 — Voir la toile en direct](https://github.com/Coordination-Front-Back-M2-TP/Coordination-Front-Back-M2-TP/issues/15). Il ne couvre pas la pose d’un pixel : ce parcours relève de la story #21 et de son contrat dédié.

## Conventions

- L’API HTTP est préfixée par `/api`. Les corps HTTP sont en JSON ; les clés sont en `camelCase`.
- La consultation de la toile et l’abonnement temps réel sont publics : aucun compte n’est nécessaire pour regarder.
- La toile fait 101 × 101 pixels. Avec une origine au centre, les coordonnées vont de `-50` à `50` sur les deux axes ; `(0, 0)` est le pixel central. Cette taille compacte s’affiche sur un écran 800 × 600 avec une marge pour les commandes.
- `x` augmente vers la droite et `y` augmente vers le bas, pour correspondre aux coordonnées écran. Les deux bornes sont inclusives ; toute coordonnée hors de `-50..50` est invalide.
- `color` est une couleur hexadécimale `#RRGGBB` appartenant à la palette du jeu. La palette exacte reste à valider.
- Les dates sont en UTC au format ISO 8601, par exemple `2026-10-27T14:30:00.000Z`.
- Les données publiques représentent uniquement l’état visuel courant de la toile. Elles ne contiennent ni historique des poses, ni pseudo, ni identifiant de compte, ni autre identité de joueur. L’historique relève d’un contrat distinct.
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
| `x` | entier | Colonne du pixel, à partir de zéro |
| `y` | entier | Ligne du pixel, à partir de zéro |
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

## Règles de cohérence et de performance

- Le serveur persiste le changement avant d’émettre `pixel:updated` ; un événement ne doit jamais annoncer une écriture qui a échoué.
- La persistance de l’état du pixel et l’attribution de sa révision sont atomiques. Deux changements distincts ne partagent pas la même révision.
- Une mise à jour reçue remplace le pixel local aux mêmes coordonnées si sa révision est plus récente. La réception du même événement à nouveau ne doit pas créer un doublon ni faire régresser l’état.
- Le client met en tampon les événements reçus avant l’ACK d’abonnement, installe l’instantané, puis applique uniquement les événements de révision supérieure. Après une reconnexion, il demande un nouvel instantané.
- L’objectif produit est qu’un changement enregistré apparaisse chez les autres joueurs en moins d’une seconde.
- Les erreurs HTTP utilisent le statut approprié et le format `error` standard. Les erreurs Socket.IO utilisent `canvas:error`.

## Points restant à valider avant implémentation

- Le format de couleur `#RRGGBB` est celui du pixel transmis. La palette autorisée reste à fixer dans le contrat de pose de pixel (#21).
- Le front et le back retiennent une lecture publique limitée à la résolution et à l’état visible courant des pixels, sans historique ni identité du joueur. L’historique et l’identité ne sont pas nécessaires à l’affichage de la toile et restent dans les contrats des fonctionnalités qui en ont besoin.
- Si la résolution augmente, prévoir pagination ou transfert compact dans un contrat ultérieur.
- Les choix de résolution, d’axe, de taille d’instantané et de forme de `canvas:error` ci-dessus reprennent la proposition pour livrer l’issue #35 ; ils restent modifiables par l’équipe.
