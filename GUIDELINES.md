# Conventions de code de P1X3L

Ces règles valent pour tout le code du dépôt. Les relecteurs s'en servent pendant la revue ([CONTRIBUTING.md](CONTRIBUTING.md), section 10). Pour changer une règle, ouvrir une issue, comme pour le reste.

## 1. Principes

- Lisible avant d'être astucieux : le code se relit plus souvent qu'il ne s'écrit.
- Une fonction a un seul rôle et reste courte.
- Le contrat d'abord : une route ou un message temps réel est écrit dans le contrat (section 6) avant d'être codé.

## 2. Structure du dépôt

```text
front/        application React (Vite)
back/         API Node.js (Express)
docs/         documentation (stratégie de branches, gestion de projet)
e2e/          tests de bout en bout (Playwright)
```

Le code est rangé **par fonctionnalité** : tout ce qui sert à une même chose est dans le même dossier.

```text
front/src/
  api/                     appels à l'API et au temps réel (canvas.js, pixels.js…)
  components/
    PixelPlacer/           un dossier par composant :
      PixelPlacer.jsx        le composant
      PixelPlacer.module.css ses styles, s'il en a
      PixelPlacer.stories.jsx ses stories Ladle
      PixelPlacer.test.jsx   ses tests
back/src/
  canvas/                  un dossier par fonctionnalité du jeu :
    canvas-routes.js         routes HTTP (lire la requête, répondre)
    canvas-service.js        règles du jeu
    canvas-repository.js     accès aux données (Prisma)
  errors/, middleware/, utils/   ce qui sert à toutes les fonctionnalités
  app.js                   monte les routes de chaque fonctionnalité sous /api
back/test/                 tests du back, un fichier par sujet
```

Une nouvelle fonctionnalité du back (par exemple les équipes) a son dossier `back/src/teams/`, avec les mêmes trois fichiers. Un nouveau composant a son dossier dans `front/src/components/`, même s'il n'a qu'un fichier pour l'instant. Les tests du front sont à côté du fichier testé.

## 3. Nommage

| Élément | Convention | Exemple |
| --- | --- | --- |
| Fichiers | kebab-case, sauf les composants React (PascalCase) | `canvas-store.js`, `ColorPalette.jsx` |
| Variables et fonctions | camelCase | `placePixel` |
| Composants et classes | PascalCase | `ColorPalette` |
| Constantes | MAJUSCULES_AVEC_TIRETS_BAS | `PIXEL_COOLDOWN_MS` |
| Routes d'API | noms au pluriel, en minuscules (sauf `/api/health`, qui décrit un état) | `/api/teams` |

Langue du code : anglais pour le code (noms, routes, clés JSON), français pour la documentation, les commentaires et les tickets.

## 4. Front

- Framework : React 19 avec Vite 8.
- Un composant par fichier. Les appels à l'API passent par `src/api/`, jamais directement depuis un composant. L'état reste dans le composant qui s'en sert : un état partagé (la toile, le joueur connecté) se choisit avec la première user story qui en a besoin.
- Accessibilité : niveau AA du WCAG. Chaque champ a un libellé, tout se fait au clavier, les contrastes sont suffisants.
- Styles : CSS Modules (`*.module.css`), fournis par Vite. Les couleurs, polices et espacements seront des variables CSS communes, définies avec le design.

## 5. Back

- Framework : Express 5, sur Node.js 22.12 ou plus.
- Trois couches, dans le dossier de chaque fonctionnalité (section 2) : `*-routes.js` lit la requête et répond, `*-service.js` applique les règles du jeu (délai, quota, équipes), `*-repository.js` accède aux données avec Prisma.
- Chaque entrée de l'API est validée avant d'être utilisée.
- Une erreur renvoie le bon code HTTP et un corps au format de la section 6.

## 6. Contrat entre le front et le back

Le contrat est la liste des routes de l'API, avec ce qu'elles reçoivent et ce qu'elles renvoient. Le front et le back s'appuient dessus pour avancer en parallèle.

- Où il est décrit : `docs/contrat-api.md`, créé par la première tâche contrat. Il liste les routes de l'API et les événements Socket.IO, avec ce qu'ils reçoivent et ce qu'ils renvoient.
- Quand une route change, le contrat change dans la même PR, et l'autre partie de l'équipe est prévenue dans l'issue.
- Données en JSON, clés en camelCase, dates au format ISO 8601 (`2026-10-09T14:30:00Z`).
- Un changement qui casse le contrat demande l'accord du front et du back avant le merge, ou une nouvelle version de l'API (`/api/v2`).

Format d'une erreur :

```json
{ "error": { "code": "COOLDOWN_ACTIVE", "message": "Attends encore 12 secondes avant de poser un pixel." } }
```

## 7. Tests

- Outils : Vitest pour le front, à installer avec le premier composant testé, et `node:test` (intégré à Node.js) pour le back. Les tests de bout en bout utilisent Playwright, dans `e2e/` à la racine (voir [docs/tests-e2e.md](docs/tests-e2e.md)).
- Une nouvelle fonctionnalité a au moins un test. Un bug corrigé reçoit un test qui l'aurait détecté.
- Les tests passent en local avant d'ouvrir la PR. La CI les relance.

## 8. Lint et format

- Outils : oxlint pour le front (pas encore de lint pour le back), et Prettier pour le format, à installer. La CI les vérifie. Les commandes sont dans [INSTALL.md](INSTALL.md).
- Une règle désactivée l'est avec un commentaire qui dit pourquoi.

## 9. Sécurité

- Aucun secret dans le dépôt : les clés passent par des variables d'environnement ([INSTALL.md](INSTALL.md), section 3).
- Les dépendances viennent du registre officiel, avec une version fixée. Les mises à jour passeront par Dependabot, à activer par la personne qui s'occupe de la CI.
- Aucune donnée personnelle ni aucun jeton dans les logs.

## 10. Commentaires et documentation

- Un commentaire dit pourquoi, pas ce que fait le code.
- Langue des commentaires : français.
- Une route, une variable d'environnement ou une commande qui change met à jour le contrat d'API, [INSTALL.md](INSTALL.md) ou [README.md](README.md) dans la même PR.
