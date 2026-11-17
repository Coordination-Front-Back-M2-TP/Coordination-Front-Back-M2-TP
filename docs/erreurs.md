# Gestion centralisée des erreurs et journalisation du back-end

Ce document décrit le fonctionnement du gestionnaire d'erreurs centralisé du back-end P1X3L, la structure des réponses transmises au front-end, ainsi que la politique de journalisation et de sécurité des logs.

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

---

## 5. Couverture des tests et scénarios non testés

`npm test --prefix back` (lancé par la CI) vérifie le gestionnaire d'erreurs dans `back/test/errors.test.js` et `back/test/errors-environnements.test.js`. Le front est couvert par les tests Vitest décrits dans [erreurs-front.md](erreurs-front.md).

| Scénario | Test |
| --- | --- |
| Erreur attendue (4xx) en développement : code, message, `details` et `stack` | `errors-environnements.test.js` |
| Erreur attendue (4xx) en production : code et message conservés, ni `details` ni `stack` | `errors-environnements.test.js` |
| Erreur inattendue (5xx) en développement : message et `stack` exposés | `errors-environnements.test.js` |
| Erreur inattendue (5xx), `AppError` 500 et erreur Prisma inconnue en production : réponse générique, aucun secret ni code ORM, ni dans la réponse ni dans les journaux | `errors-environnements.test.js` |
| Prisma `P2002` / `P2025`, contrainte d'unicité SQLite | `errors.test.js`, `errors-environnements.test.js` |
| Route inconnue et JSON invalide sur l'application réelle | `errors-environnements.test.js` |
| Cooldown (429), masquage des données sensibles des journaux | `errors.test.js` |

Scénarios identifiés mais **non testés**, faute de route ou de code concerné :

- `UNAUTHORIZED` (401) et `FORBIDDEN` (403) : aucune authentification n'existe encore, seules les usines `unauthorized` et `forbidden` sont définies.
- `COOLDOWN_ACTIVE` sur une vraie route de pose de pixel : la route n'existe pas, seule l'usine `tooManyRequests` est testée.
- Corps de requête trop volumineux (413) et encodage invalide : non normalisés par le gestionnaire, qui renvoie le statut d'`express.json()`.
- Erreurs Prisma autres que `P2002` et `P2025` (ex. `P2024`, délai de connexion) : traitées comme des erreurs inattendues, sans cas dédié.
- Erreurs d'une vraie base de données (panne, SQLite verrouillée) : les tests simulent les erreurs, aucune base n'est lancée.
- Erreurs Socket.IO côté serveur : hors du gestionnaire HTTP, non couvertes.
- Tests de bout en bout navigateur (erreur API affichée dans une vraie page) : seuls des tests de composants jsdom existent.
