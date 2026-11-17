# Documentation de l'API back-end

Ce document décrit la formalisation du contrat d'API pour P1X3L, la comparaison technique ayant conduit au choix d'OpenAPI/Swagger, ainsi que les points d'accès et les exemples de réponses.

Le contrat proposé pour la lecture de la toile et ses événements temps réel est décrit dans [docs/contrat-api.md](contrat-api.md). Il reste à valider par le front et le back avant implémentation.

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

Renvoie l'instantané courant de la toile (101 × 101, représentation creuse). Lecture publique, sans authentification. Le format exact est celui du [contrat API](contrat-api.md).

### `POST /api/pixels`

Pose un pixel sur la toile, selon le [contrat de pose](contrat-api.md). En service depuis l'issue #44.

- **URL** : `/api/pixels`
- **Méthode** : `POST`
- **Authentification** : session requise — voir le paragraphe « Session de démonstration » ci-dessous

#### Requête

```json
{
  "x": 12,
  "y": 8,
  "color": "#D93A3A"
}
```

`x` et `y` sont des entiers de `-50` à `50` (bornes incluses) et `color` est au format `#RRGGBB`. La palette autorisée n'est pas encore fixée par le contrat : seul le format est vérifié, et la restriction à la palette arrivera avec sa décision.

#### Réponse de succès (200 OK)

```json
{
  "pixel": {
    "x": 12,
    "y": 8,
    "color": "#D93A3A",
    "updatedAt": "2026-11-17T14:30:00.000Z",
    "revision": 185
  },
  "cooldownEndsAt": "2026-11-17T14:30:10.000Z"
}
```

Chaque pose acceptée crée aussi une entrée d'historique (compte, équipe, coordonnées, couleur, heure serveur), jamais renvoyée ni diffusée, et le serveur émet `pixel:updated` aux abonnés après la persistance.

`cooldownEndsAt` est calculé avec la durée de démonstration de 10 secondes (constante `PIXEL_COOLDOWN_MS` réglable côté serveur) mais n'est **pas encore contraignant** : le rejet `429 COOLDOWN_ACTIVE` pendant le délai est l'issue #46.

#### Erreurs

- `400 INVALID_INPUT` : coordonnées invalides ou couleur absente ou mal formée.
- `401 UNAUTHORIZED` : aucune session valide.
- `429 COOLDOWN_ACTIVE` : prévu par le contrat, pas encore appliqué (issue #46).

Une pose refusée ne modifie ni la toile, ni l'historique, ni le délai.

#### Session de démonstration (temporaire)

Le vrai mécanisme d'authentification (contrat #18, back #39) n'existe pas encore. En attendant, un placeholder clairement marqué TEMPORAIRE (`back/src/auth/session-placeholder.js`) propose de transmettre la session par l'en-tête HTTP `X-Session-Id` : toute valeur non vide donne accès à un compte et une équipe de démonstration, et son absence renvoie `401 UNAUTHORIZED`. Cette proposition de transport est à faire valider en revue et sera remplacée par le mécanisme du contrat #18.

---

## 4. Format standard des erreurs

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
