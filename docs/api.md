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

Conformément à la règle de ne pas inventer d'API future non implémentée, seule la route réellement en service est documentée.

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
