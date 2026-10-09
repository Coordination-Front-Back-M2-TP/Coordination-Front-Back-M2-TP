<!--
Modèle de README.md (09/10/2026). À copier à la racine d'un projet sous le nom README.md.
Remplacer chaque [[à remplir]] (chercher « [[ » pour n'en oublier aucun), supprimer ce qui ne sert pas,
puis supprimer ce commentaire.

Ce que GitHub attend d'un README : ce que fait le projet, pourquoi il est utile, comment démarrer,
où trouver de l'aide, qui le maintient et y contribue. Rien de plus que ce qu'il faut pour utiliser
et contribuer : le reste va dans `docs/`.
https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-readmes

Barème du TD POC (voir `TD_ POC.md`) : mise en forme du Markdown /1, contexte du projet /1, installation /2.
- Mise en forme : titres dans l'ordre, listes, blocs de code avec leur langage, tableaux, liens relatifs.
- Contexte : le problème, la fonctionnalité principale, pour qui.
- Installation : le pas à pas est dans `INSTALL.md` (modèle `INSTALL.modele.md`). Le README y renvoie
  sans répéter les commandes.
- La branching strategy (/2) ne va pas ici : elle est dans `CONTRIBUTING.md`. Y renvoyer.
- Les conventions de code vont dans `GUIDELINES.md` (modèle `GUIDELINES.modele.md`).
-->

# [[Nom du projet]]

Une pixel war en équipes : une toile partagée où chacun pose un pixel à la fois, aidé par un agent qui dessine des modèles proposés par une IA.

## Contexte

Projet du cours « Coordination Front&Back » (Ynov, M2). Une pixel war est une toile commune où chaque joueur pose un pixel, puis attend avant le suivant : les dessins naissent de la coordination entre joueurs. Ici, les joueurs s'affrontent en équipes de couleur. Pour les aider, une IA transforme une consigne (« un dragon rouge ») en modèle de pixels, et un agent de dessin le pose au rythme du joueur. Le projet oblige le front et le back à se coordonner en temps réel, ce qui est le sujet du cours.

**Fonctionnalité principale :** poser des pixels en temps réel sur une toile partagée, à la main ou avec un agent de dessin qui suit un modèle proposé par l'IA.

Le besoin complet (règles du jeu, rôle de l'IA, périmètre, critères de réussite) est dans [docs/besoin.md](docs/besoin.md).

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

Le guide pas à pas est dans [INSTALL.md](INSTALL.md) : prérequis, configuration, lancement, vérification, tests et problèmes fréquents.

## Structure du dépôt

```text
[[dossier/]]    [[ce qu'il contient]]
[[dossier/]]    [[ce qu'il contient]]
```

## Contribuer

Le guide est dans [CONTRIBUTING.md](CONTRIBUTING.md) : tickets, branches, commits, pull requests, versions. Les conventions de code sont dans [GUIDELINES.md](GUIDELINES.md). Le board du projet : [TP Coordination Front&Back](https://github.com/orgs/Coordination-Front-Back-M2-TP/projects/1).

## Équipe

| Nom | Rôle |
| --- | --- |
| [[Nom]] | [[Product owner, front ou back]] |

## Licence

[[Licence du projet, ou : projet scolaire.]]
