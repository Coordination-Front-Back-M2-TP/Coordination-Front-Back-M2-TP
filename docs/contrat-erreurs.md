# Contrat partagé de gestion des erreurs front/back

Cette page rassemble les éléments à valider par les responsables front et back. **Le contrat n'est pas encore validé** : les formats, codes et statuts ci-dessous décrivent le comportement actuellement observé dans le back-end, pas des décisions à appliquer aux futures routes. Les points ouverts restent à arbitrer ensemble avant de figer le contrat.

## État actuel du back-end

Le middleware du back-end renvoie actuellement cette enveloppe JSON :

```json
{
  "error": {
    "code": "CODE_MACHINE",
    "message": "Message d'erreur"
  }
}
```

En développement, `details` et `stack` sont ajoutés lorsqu'ils existent. En production, le back-end n'inclut ni `details` ni `stack` dans la réponse ; pour les erreurs 5xx, il remplace aussi le code et le message par `INTERNAL_SERVER_ERROR` et un message générique. Pour les autres statuts, le code et le message de l'erreur sont conservés : leur caractère sûr et compréhensible pour l'utilisateur reste à valider.

Les associations suivantes sont présentes dans les fabriques d'erreurs ou la normalisation du back-end. Elles ne constituent pas encore une convention validée pour les deux côtés.

| Statut HTTP observé | Code observé | Cas associé dans le back-end |
| --- | --- | --- |
| 400 Bad Request | `INVALID_JSON` | Syntaxe JSON invalide dans le corps de la requête |
| 400 Bad Request | `BAD_REQUEST` | Erreur créée par la fabrique `badRequest` |
| 401 Unauthorized | `UNAUTHORIZED` | Erreur créée par la fabrique `unauthorized` |
| 403 Forbidden | `FORBIDDEN` | Erreur créée par la fabrique `forbidden` |
| 404 Not Found | `NOT_FOUND` / `RECORD_NOT_FOUND` | Route inconnue / enregistrement absent |
| 409 Conflict | `CONFLICT` | Conflit ou contrainte d'unicité |
| 429 Too Many Requests | `COOLDOWN_ACTIVE` | Erreur créée par la fabrique `tooManyRequests` |
| 500 Internal Server Error | `INTERNAL_SERVER_ERROR` | Erreur inattendue ou erreur serveur masquée en production |

Le back-end utilise `AppError` pour les erreurs typées, un middleware Express pour les normaliser et un logger qui filtre certaines clés sensibles. Les erreurs 4xx sont journalisées en `WARN`, les erreurs serveur ou non opérationnelles en `ERROR`. En cas d'erreur serveur, la stack est transmise au logger ; le message brut de l'exception n'est pas ajouté aux métadonnées du log.

## Décisions à arbitrer ensemble

| Sujet | État / exigence | Décision front/back |
| --- | --- | --- |
| Enveloppe et champs obligatoires de la réponse | Le back-end renvoie actuellement `error.code` et `error.message`. | [[à remplir]] |
| Statut HTTP et code stable par cas d'erreur | Associations constatées ci-dessus ; elles ne couvrent pas encore les décisions pour toutes les futures routes. | [[à remplir]] |
| Erreurs attendues et inattendues | Le back-end distingue actuellement les erreurs opérationnelles des autres erreurs pour les logs. | [[à remplir]] |
| Informations renvoyées en développement et en production | L'US parente interdit d'exposer en production secrets, stack traces et détails internes. Le comportement constaté est décrit ci-dessus. | [[à remplir]] |
| Cas à journaliser et données autorisées | Le logger masque certaines clés et exclut le message brut des métadonnées d'erreur serveur. | [[à remplir]] |
| Consommation des erreurs API par le front | La page d'erreurs du front documente les retours actuellement visibles, mais le format partagé reste à valider. Voir [Erreurs visibles côté front](erreurs-front.md). | [[à remplir]] |

Les exemples destinés à la production doivent utiliser des données fictives et ne jamais révéler de secret, stack trace, requête SQL, détail ORM ou autre information interne.
