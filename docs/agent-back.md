# Agent de dessin (back)

Tâche #51, user story [#25 — Confier le modèle à mon agent](https://github.com/Coordination-Front-Back-M2-TP/Coordination-Front-Back-M2-TP/issues/25). Le back suit la [proposition de contrat](contrat-api.md#dessiner-avec-lia--agent-de-dessin). Le front est la tâche #50. La pose et son délai sont décrits dans [pose-back.md](pose-back.md).

## Routes

| Route | Succès | Erreurs |
| --- | --- | --- |
| `POST /api/agent` `{ pixels }` | `201 { agent }` | `400 INVALID_INPUT`, `401 UNAUTHORIZED`, `403 TEAM_REQUIRED`, `403 ACCOUNT_BANNED`, `409 AGENT_ALREADY_ACTIVE` |
| `GET /api/agent` | `200 { agent }`, `agent` à `null` sans agent | `401 UNAUTHORIZED` |
| `DELETE /api/agent` | `204` | `401 UNAUTHORIZED` |

L'agent est toujours celui du compte de la session.

## Ce que fait l'agent

L'agent est un programme du serveur, sans IA ([besoin.md](besoin.md)).

- **Un pixel par fin de délai** : à chaque passage, il compare le modèle et la toile, et pose le premier pixel du modèle qui ne correspond pas. Il attend ensuite la fin du délai du compte.
- **Réparation** : un pixel du modèle écrasé par une autre équipe ne correspond plus, donc il est reposé. Un pixel déjà à la bonne couleur n'est pas reposé, même posé par quelqu'un d'autre.
- **Modèle fini** : l'agent reste actif. Il regarde la toile chaque seconde et répare ce qui a été écrasé, jusqu'à ce que le joueur l'arrête.
- **Hors connexion** : l'agent ne dépend pas de la session. Il continue quand le joueur se déconnecte.
- **Redémarrage du serveur** : l'agent est enregistré dans la base. Au démarrage, le serveur relance les agents enregistrés.

## Les mêmes règles qu'une pose à la main

L'agent pose par le service de toile, comme `POST /api/pixels`. Chaque pose est donc inscrite dans l'historique avec le compte et son équipe du moment, compte pour le délai du compte et part en `pixel:updated`.

- **Un compte, un délai** : tant que l'agent du compte existe, `POST /api/pixels` répond `409 AGENT_ACTIVE`. L'agent ne donne pas plus de pixels qu'une pose à la main.
- **Un seul modèle par compte** : un second lancement répond `409 AGENT_ALREADY_ACTIVE`. La base tient la règle : la clé de la table est le compte.
- **Équipe obligatoire** : sans équipe, le lancement répond `403 TEAM_REQUIRED`.
- **Joueur banni** : le lancement répond `403 ACCOUNT_BANNED`, même si la session a été lue avant le bannissement. La transaction de bannissement retire l’agent enregistré.

## Modèle

Le front envoie le modèle déjà placé : une liste de `{ x, y, color }` en coordonnées de la toile. Le modèle contient de 1 à 1 024 pixels, tient dans un carré de 32 × 32 cases, et ne nomme pas deux fois la même case. Les couleurs sont au format `#RRGGBB`, comme pour une pose.

Le back ne sait pas d'où vient le modèle : il peut venir de l'IA (#49) ou d'ailleurs. C'est voulu, pour livrer l'agent avant la demande de modèle.

## Progression

`GET /api/agent` rend `total`, `done` et `nextPlacementAt`. `done` compte les pixels du modèle que la toile montre déjà. `nextPlacementAt` est l'heure prévue de la prochaine pose ; il vaut `null` quand le modèle est fini.

Aucun événement temps réel ne porte la progression. Le front relit la route, ou compte lui-même à partir de `pixel:updated`.

## Utiliser l’agent depuis la toile

Connectez-vous et rejoignez une équipe. Dans « Agent de dessin », importez un fichier JSON qui contient les pixels déjà placés, puis choisissez « Lancer l’agent ».

```json
{
  "pixels": [
    { "x": 10, "y": 10, "color": "#D93A3A" },
    { "x": 11, "y": 10, "color": "#D93A3A" }
  ]
}
```

Le front relit la progression toutes les deux secondes et retrouve l’agent après un rechargement. « Arrêter l’agent » rend la pose manuelle disponible. Les pixels déjà posés restent sur la toile. La génération par consigne est suivie dans l’US #24.

## Comment c'est fait

Le code est dans `back/src/agents/` : `agent-routes.js`, `agent-service.js` et `agent-repository.js` ([GUIDELINES.md](../GUIDELINES.md), section 5). Le refus de la pose à la main est dans `back/src/canvas/canvas-routes.js`.

- Le service garde un minuteur par compte. Un passage fait au plus une pose, puis programme le suivant.
- Le compte est relu à chaque passage : l'équipe est celle du moment, et un compte banni arrête l'agent.
- Une erreur passagère ne stoppe pas l'agent : elle est journalisée et il réessaie une seconde plus tard.
- La migration `add_drawing_agent` crée la table `DrawingAgent` : le compte, le modèle en JSON, l'heure du lancement. Une ligne existe tant que l'agent travaille ; l'arrêt la supprime.

## Points en attente

- **Contrat** : la tâche contrat de l'EPIC (#47) n'est pas faite. Les routes, le format du modèle et les codes d'erreur sont une proposition : à relire par le front (#50) et le back.
- **Modèle de l'IA** (#49) : rien ne vérifie que le modèle envoyé vient d'une demande à l'IA. Le lien se fera quand #49 existera.
- **Palette** : la palette autorisée n'est pas fixée. L'agent accepte toute couleur `#RRGGBB`, comme la pose.
- **Agent qui ne s'arrête pas seul** : un joueur qui oublie son agent ne peut plus poser à la main tant qu'il ne l'a pas arrêté. Un arrêt automatique à la fin du modèle enlèverait la réparation : à décider par l'équipe.
- **Un seul serveur** : les minuteurs vivent dans le processus du back. Avec plusieurs instances du back, deux agents du même compte tourneraient ; le délai du compte les empêcherait quand même de poser plus vite.
- **Progression en direct** : pas d'événement dédié, les connexions Socket.IO ne portent pas la session.

## Vérifications

`npm test --prefix back` (`test/agents.test.js`) couvre les refus `401` et `403`, le modèle posé de bout en bout au rythme du délai, la progression, la pose à la main refusée, le pixel écrasé reposé, le pixel déjà bon laissé, le modèle unique par compte, l'arrêt, le joueur déconnecté, la reprise au démarrage, le joueur banni et les modèles invalides.
