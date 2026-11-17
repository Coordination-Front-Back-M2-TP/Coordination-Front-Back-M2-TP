# Documentation de l'API back-end

Ce document décrit la formalisation du contrat d'API pour P1X3L, la comparaison technique ayant conduit au choix d'OpenAPI/Swagger, ainsi que les points d'accès et les exemples de réponses.

Le contrat de la lecture de la toile et de ses événements temps réel est décrit dans [docs/contrat-api.md](contrat-api.md). La lecture (`GET /api/pixels` et abonnement Socket.IO) est implémentée ; la pose d'un pixel par le joueur relève d'un contrat dédié à venir.

---

## 1. Choix technique : Swagger/OpenAPI vs Postman

Pour documenter, tester et partager le contrat d'API entre le front-end et le back-end, deux solutions standards ont été comparées : **Swagger / OpenAPI** et **Postman**.

### Tableau comparatif

| Critère | Swagger / OpenAPI | Postman | Choix pour P1X3L |
| --- | --- | --- | --- |
| Standard | Spécification ouverte universelle (OpenAPI 3.0 / 3.1) adoptée par l'industrie | Format propriétaire (collections JSON exportées) | **OpenAPI** |
| Découplage machine-readable | Permet la génération de types, mocks, clients HTTP et validation automatique | Principalement orienté client de test manuel | **OpenAPI** |
| Consultation sans outil tiers | Interface Swagger UI embarquée accessible directement depuis le navigateur | Nécessite l'application Postman ou un compte Postman Cloud | **Swagger UI** |
| Partage pour tests manuels | Importable dans tous les clients API (Insomnia, Postman, VS Code) | Facile à manipuler pour les tests manuels exploratoires | Égalité |

### Décision validée

**OpenAPI 3.0 (avec Swagger UI)** est retenu comme standard officiel pour le contrat d'API de P1X3L :

- La spécification formelle est conservée dans [`back/src/openapi.json`](../back/src/openapi.json).
- L'interface interactive Swagger UI est directement servie par l'application sur le point d'entrée `` `http://localhost:3000/api/docs` `` via `swagger-ui-express`.
- Une collection Postman équivalente est également mise à disposition dans [`docs/p1x3l.postman_collection.json`](p1x3l.postman_collection.json) pour faciliter les tests manuels des développeurs utilisant Postman.

---

## 2. Accès à la documentation

Lorsque le back est démarré (`npm run dev --prefix back`) :

| Ressource | URL | Description |
| --- | --- | --- |
| Swagger UI interactif | `` `http://localhost:3000/api/docs` `` | Documentation interactive dans le navigateur |
| Spécification OpenAPI brute | `` `http://localhost:3000/api/openapi.json` `` | Fichier JSON OpenAPI 3.0 |
| Collection Postman | `docs/p1x3l.postman_collection.json` | Fichier prêt à importer dans Postman |

---

## 3. Routes actuellement disponibles

Conformément à la règle de ne pas inventer d'API future non implémentée, seules les routes réellement en service sont documentées.

### `GET /api/health`

Vérifie que l'API fonctionne et renvoie la version du commit déployé.

- **URL** : `/api/health`
- **Méthode** : `GET`
- **Authentification** : Aucune (publique)

#### Réponse de succès (200 OK)

```json
{
  "status": "ok",
  "version": "dev"
}
```

- `status` (chaîne) : vaut toujours `"ok"` lorsque le service est fonctionnel.
- `version` (chaîne) : identifiant du commit Git (fourni par `APP_VERSION` lors du déploiement Docker) ou `"dev"` en environnement de développement local.

### `GET /api/pixels`

Renvoie l'état courant de la toile : dimensions, révision globale et pixels posés. Cette route sert les consultations HTTP ; le client temps réel reçoit le même instantané dans l'ACK de `canvas:subscribe` (section 4).

- **URL** : `/api/pixels`
- **Méthode** : `GET`
- **Authentification** : Aucune (publique)

#### Réponse de succès (200 OK)

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

- `width` et `height` (entiers) : dimensions de la toile, `101 × 101`. L'origine est au centre : les coordonnées vont de `-50` à `50` inclus, `x` augmente vers la droite et `y` vers le bas.
- `revision` (entier) : dernière révision incluse dans l'instantané ; elle est strictement croissante à chaque changement de la toile et vaut `0` tant que la toile est vide.
- `snapshotAt` (date ISO 8601 UTC) : heure serveur de lecture de l'instantané.
- `pixels` (tableau) : représentation creuse de la toile — seuls les pixels posés sont listés, au plus un état par coordonnée, chacun avec sa `revision` inférieure ou égale à celle de l'instantané. Une toile vide renvoie `[]`.
- Chaque pixel suit le modèle `Pixel` : `x`, `y` (entiers), `color` (`#RRGGBB`), `updatedAt` (date ISO 8601 UTC d'enregistrement), `revision` (entier). Aucune identité de joueur ni historique n'est renvoyé.

La toile est stockée en mémoire vive (`back/src/services/canvas-store.js`) : le projet n'a pas encore de base de données et la démo tient dans un processus unique. La toile et la révision repartent donc de zéro à chaque redémarrage du back. La structure du module (instantané, `Pixel`, événement de diffusion) est prévue pour brancher une persistance ultérieure sans changer le contrat.

En cas d'erreur interne, la réponse suit le format standard de la section 5 (aucun détail technique en production).

---

## 4. Événements temps réel (Socket.IO)

Le serveur Socket.IO écoute sur le même port que l'API (`` `http://localhost:3000` `` en local, transmis par le proxy Vite et par Nginx). Le client se connecte au namespace `/`, sans authentification : la lecture de la toile est publique.

### Client → serveur : `canvas:subscribe`

Abonne le socket aux changements de la toile. Aucun payload n'est requis. L'ACK Socket.IO renvoie un instantané complet, au même format que `GET /api/pixels`. Le serveur enregistre l'abonnement avant de lire l'instantané : un changement posé entre les deux est diffusé par `pixel:updated` avec une révision supérieure à celle de l'instantané. Après une reconnexion, une nouvelle souscription renvoie un instantané complet actualisé.

### Serveur → client : `pixel:updated`

Après l'enregistrement réussi d'un changement de pixel, le serveur émet cet événement aux abonnés. Le payload est le `Pixel` canonique enregistré (mêmes champs que dans l'instantané) :

```json
{
  "x": 12,
  "y": 8,
  "color": "#D93A3A",
  "updatedAt": "2026-10-27T14:30:00.000Z",
  "revision": 185
}
```

Le serveur persiste le changement avant d'émettre : un événement n'annonce jamais une écriture qui a échoué. Les révisions sont attribuées de façon atomique, sans doublon, et strictement croissantes.

### Client → serveur : `canvas:unsubscribe`

Met fin à l'abonnement du socket. Aucun payload ni réponse ne sont requis. La déconnexion ferme également l'abonnement.

### Serveur → client : `canvas:error`

Signale une erreur d'abonnement ou de lecture. Le payload suit le format standard, sans stack ni détail de diagnostic, même en développement :

```json
{
  "error": {
    "code": "BOARD_UNAVAILABLE",
    "message": "La toile est momentanément indisponible."
  }
}
```

---

## 5. Format standard des erreurs

Conformément aux conventions définies dans [GUIDELINES.md](../GUIDELINES.md) (section 6), toutes les erreurs renvoyées par l'API adoptent une structure homogène avec un code machine explicite et un message en français :

```json
{
  "error": {
    "code": "CODE_ERREUR",
    "message": "Description claire de l'erreur en français."
  }
}
```

### Exemples d'erreurs prévues par le contrat

- **404 Not Found** (ressource inexistante) :

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "La route ou la ressource demandée n'existe pas."
  }
}
```

- **429 Too Many Requests** (délai de cooldown non expiré) :

```json
{
  "error": {
    "code": "COOLDOWN_ACTIVE",
    "message": "Attends encore 12 secondes avant de poser un pixel."
  }
}
```

- **500 Internal Server Error** (erreur inattendue) :

```json
{
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "Une erreur inattendue est survenue."
  }
}
```

En production, le middleware proposé dans la PR [#110](https://github.com/Coordination-Front-Back-M2-TP/Coordination-Front-Back-M2-TP/pull/110) masque le message interne avec cette réponse générique. En développement, il peut ajouter `details` et `stack` à l’objet `error` pour faciliter le diagnostic.
