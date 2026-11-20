# Tests de bout en bout (E2E)

Mis en place pour l'issue [#114](https://github.com/Coordination-Front-Back-M2-TP/Coordination-Front-Back-M2-TP/issues/114). Ils vérifient dans un vrai navigateur les critères d'acceptation de la user story [#15 — Voir la toile en direct](https://github.com/Coordination-Front-Back-M2-TP/Coordination-Front-Back-M2-TP/issues/15).

## Choix de l'outil : Playwright

L'outil retenu est [Playwright](https://playwright.dev/), pour ces raisons :

- il pilote un vrai navigateur (Chromium, Firefox ou WebKit) : le premier scénario vérifie le rendu réel du `canvas`, pas seulement le DOM ;
- son option `webServer` lance le serveur de développement Vite avant les tests et l'arrête après : aucune orchestration à écrire ;
- l'installation des navigateurs en CI tient en une commande (`npx playwright install --with-deps chromium`) ;
- les traces, captures d'écran et rapports HTML facilitent le diagnostic d'un échec, en local comme en CI ;
- c'est le standard actuel pour les projets React avec Vite, sans couche supplémentaire.

Cypress était l'alternative crédible. Playwright a été préféré pour son `webServer` intégré, son mode headless simple en CI et ses traces.

## Architecture : un serveur Socket.IO « contrat »

Le back de la toile ([#35](https://github.com/Coordination-Front-Back-M2-TP/Coordination-Front-Back-M2-TP/issues/35)) n'existe pas encore. Les tests s'appuient donc sur un serveur « contrat » ([`e2e/contract-server.js`](../e2e/contract-server.js)), lancé par les tests sur le port 3000, qui implémente fidèlement le [contrat d'API](contrat-api.md) :

- l'ACK de `canvas:subscribe` renvoie un instantané seedé avec des pixels connus (`SEED_PIXELS`) ;
- `placePixel` enregistre un changement puis diffuse `pixel:updated`, comme le contrat l'exige ;
- les routes `GET /api/pixels` et `GET /api/health` répondent au format du contrat.

Le front est servi par le serveur de développement Vite, dont le proxy envoie `/socket.io` et `/api` vers le port 3000 ([`front/vite.config.js`](../front/vite.config.js)) : le navigateur est branché exactement comme en local, sans modification du front.

**Limitation assumée** : ce serveur n'a pas de persistance et sera remplacé par le vrai back quand [#35](https://github.com/Coordination-Front-Back-M2-TP/Coordination-Front-Back-M2-TP/issues/35) sera livrée. Les tests devront alors lancer le back (ou conserver le serveur contrat pour des E2E rapides) : la décision se prendra dans cette tâche ou une tâche dédiée.

## Scénarios couverts

| Scénario | Critère de la US #15 |
| --- | --- |
| Ouvrir la page sans compte : les pixels seedés sont visibles dans le canvas et dans la liste textuelle, sans aucune authentification envoyée | Critère 1 : voir les pixels déjà posés |
| Le serveur contrat diffuse `pixel:updated` : le pixel apparaît dans le navigateur en moins d'une seconde | Critère 2 : un pixel posé ailleurs apparaît en moins d'une seconde |

Le critère 2 est couvert sans la pose de pixel ([#21](https://github.com/Coordination-Front-Back-M2-TP/Coordination-Front-Back-M2-TP/issues/21)) : le serveur contrat émet directement l'événement, ce qui équivaut côté navigateur à « un pixel posé ailleurs ». Quand #21 sera livrée, un scénario complet (un navigateur pose, un autre voit) pourra s'appuyer sur la même base.

## Lancer les tests en local

Les prérequis et la commande sont dans [INSTALL.md](../INSTALL.md) (sections 4 et 7) : `npm test --prefix e2e` depuis la racine. Le test lance lui-même le serveur contrat et le front ; le port 3000 doit être libre (arrêter un back local avant de lancer les tests).

Commandes utiles, depuis le dossier `e2e/` :

| But | Commande |
| --- | --- |
| Mode interactif (choisir et rejouer un test) | `npx playwright test --ui` |
| Voir le navigateur | `npx playwright test --headed` |
| Ouvrir le rapport HTML du dernier lancement | `npx playwright show-report` |

## CI

La CI lance les tests E2E sur chaque PR, dans le job dédié « Tests E2E (Playwright) » de [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) : installation du front et de `e2e/`, installation de Chromium avec ses dépendances système, puis `npm test --prefix e2e`. En cas d'échec, le rapport HTML est conservé en artefact. Le dossier `e2e/` est exclu du job générique des projets Node : ses tests échoueraient sans navigateur installé.
