# P1X3L

Une pixel war en équipes : une toile partagée où chacun pose un pixel à la fois, aidé par un agent qui dessine des modèles proposés par une IA.

## Contexte

Projet du cours « Coordination Front&Back » (Ynov, M2). Une pixel war est une toile commune où chaque joueur pose un pixel, puis attend avant le suivant : les dessins naissent de la coordination entre joueurs. Ici, les joueurs s'affrontent en équipes de couleur. Pour les aider, une IA transforme une consigne (« un dragon rouge ») en modèle de pixels, et un agent de dessin le pose au rythme du joueur. Le projet oblige le front et le back à se coordonner en temps réel, ce qui est le sujet du cours.

**Fonctionnalité principale :** poser des pixels en temps réel sur une toile partagée, à la main ou avec un agent de dessin qui suit un modèle proposé par l'IA.

Le besoin complet (règles du jeu, rôle de l'IA, périmètre, critères de réussite) est dans [docs/besoin.md](docs/besoin.md). Le découpage en EPICs et en user stories est dans la [story map](docs/story-map.md).

## Fonctionnalités

- Toile partagée en temps réel, avec un délai entre deux pixels.
- Comptes et équipes de couleur.
- Modèles de pixels générés par une IA (GPT) à partir d'une consigne, vérifiée par Jev.
- Agent de dessin qui pose le modèle à la place du joueur, au même rythme que lui.
- Classement des équipes et timelapse de la toile.

## Pile technique

| Partie | Technologie |
| --- | --- |
| Front | React avec Vite (version fixée au démarrage du code) |
| Back | Node.js avec Express et Socket.IO (versions fixées au démarrage du code) |
| Données | SQLite avec Prisma |
| IA | GPT (OpenAI) pour les modèles, Jev pour la modération des consignes |

## Installation

Le guide pas à pas est dans [INSTALL.md](INSTALL.md) : prérequis, configuration, lancement, vérification, tests et problèmes fréquents. Le parcours d'accueil du stagiaire est dans [docs/onboarding.md](docs/onboarding.md). La documentation de l'API (Swagger UI) est dans [docs/api.md](docs/api.md).

## Structure du dépôt

```text
.github/    Gabarits d'issues et de PR, labels, CI et déploiement continu
back/       API Node.js (Express)
docs/       Besoin, personas, story map, gestion de projet, stratégie de branches, déploiement, onboarding, composants, API, erreurs, toile front/back
front/      Application React (Vite)
```

## Contribuer

Le guide est dans [CONTRIBUTING.md](CONTRIBUTING.md) : tickets, branches, commits, pull requests, versions. Les conventions de code sont dans [GUIDELINES.md](GUIDELINES.md). Le board du projet : [TP Coordination Front&Back](https://github.com/orgs/Coordination-Front-Back-M2-TP/projects/1).

## Équipe

L'équipe 3L1K0PT3R :

| Nom | Rôle |
| --- | --- |
| Lucas | Product owner et développeur |
| Théo | Coordination, tech lead front et développeur |
| Swan | Tech lead back et développeur |

Tout le monde développe, sur le front comme sur le back. Les rôles sont détaillés dans [docs/gestion-de-projet.md](docs/gestion-de-projet.md).

## Licence

Projet scolaire (Ynov, M2) : pas de licence open source.
