# Implémentation actuelle des erreurs et des logs du back-end

Ce document décrit l'implémentation actuelle du gestionnaire d'erreurs et du logger du back-end P1X3L. Il ne définit pas le contrat partagé : les formats, codes et statuts restent à valider par les responsables front et back dans le [contrat partagé](contrat-erreurs.md).

---

## 1. Format unifié des réponses d'erreur

Toutes les erreurs renvoyées par l'API adoptent une structure JSON homogène conforme à [GUIDELINES.md](../GUIDELINES.md) (section 6) :

```json
{
  "error": {
    "code": "CODE_MACHINE",
    "message": "Message explicatif en français destiné à l'utilisateur."
  }
}
```

### Comportement selon l'environnement

- **En développement (`NODE_ENV !== 'production'`)** : l'objet `error` inclut des champs de diagnostic supplémentaires (`details` et `stack`) pour faciliter le débogage local.
- **En production (`NODE_ENV === 'production'`)** :
  - Les erreurs serveur inattendues (code HTTP $\ge$ 500) renvoient strictement `{ "error": { "code": "INTERNAL_SERVER_ERROR", "message": "Une erreur inattendue est survenue." } }`.
  - Aucune stack trace, requête SQL, détail ORM ou secret n'est exposé au client.

---

## 2. Typologie et codes d'erreur

Le tableau ci-dessous synthétise les codes d'erreur et statuts HTTP gérés :

| Statut HTTP | Code machine (`code`) | Cas d'usage |
| --- | --- | --- |
| 400 Bad Request | `INVALID_JSON` | Syntaxe JSON invalide dans le corps de la requête |
| 400 Bad Request | `BAD_REQUEST` / `INVALID_INPUT` | Paramètres ou données manquants ou mal formés |
| 401 Unauthorized | `UNAUTHORIZED` | Authentification absente ou jeton invalide |
| 403 Forbidden | `FORBIDDEN` | Action non autorisée pour le rôle de l'utilisateur |
| 404 Not Found | `NOT_FOUND` | Route ou ressource inexistante |
| 404 Not Found | `RECORD_NOT_FOUND` | Enregistrement de base de données introuvable |
| 409 Conflict | `CONFLICT` | Violation de contrainte d'unicité (ex: doublon) |
| 429 Too Many Requests | `COOLDOWN_ACTIVE` | Délai entre deux poses de pixel non écoulé |
| 500 Internal Server Error | `INTERNAL_SERVER_ERROR` | Exception non gérée, panne réseau ou base de données |

---

## 3. Architecture et composants

Le système repose sur trois briques modulaires situées dans `back/src/` :

1. **`errors/app-error.js`** : classe `AppError` héritant de `Error`. Permet de typer les erreurs opérationnelles avec un statut HTTP, un code machine, un message et des détails. Fournit des fonctions usines (`badRequest`, `unauthorized`, `forbidden`, `notFound`, `conflict`, `tooManyRequests`, `internalError`).
2. **`middleware/error-handler.js`** :
   - `notFoundHandler` : capture les requêtes vers des routes inconnues et déclenche une 404.
   - `errorHandler` : middleware Express à 4 arguments capturant toutes les exceptions. Il normalise les erreurs (syntaxe JSON, Prisma/SQLite), adapte la réponse selon l'environnement et appelle le logger.
3. **`utils/logger.js`** : module de journalisation structuré assurant le filtrage préalable des données sensibles.

---

## 4. Politique de journalisation et sécurité

Conformément à la règle d'or 2 et à [GUIDELINES.md](../GUIDELINES.md) (section 9) :

- **Niveaux de log** :
  - `WARN` : erreurs opérationnelles client (4xx) avec méthode, URL, statut et code d'erreur.
  - `ERROR` : erreurs serveur inattendues (5xx) avec les frames de stack, sans recopier le message brut de l'exception.
- **Assainissement strict (`sanitize`)** :
  - Les en-têtes d'authentification (`authorization`, `cookie`, `set-cookie`, `x-api-key`) sont automatiquement remplacés par `[MASQUÉ]`.
  - Les champs sensibles de corps de requête (`password`, `token`, `secret`, `key` et leurs variantes avec préfixes ou séparateurs) sont masqués récursivement avant écriture dans les logs.
  - Les URL complètes et messages bruts d'erreur ne sont pas écrits dans les logs ; les 404 n'incluent pas non plus leur URL dans la réponse. Cela évite de journaliser des secrets transmis dans une query string ou un message d'exception.
