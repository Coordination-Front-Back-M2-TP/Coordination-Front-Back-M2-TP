# Coordination-Front-Back-M2-TP

Dépôt du TP du cours Ynov M2 « Coordination Front&Back ». Au 9 octobre 2026, le produit n'est pas encore choisi : les cases `[[à remplir]]` de la documentation attendent ce choix.

Ce fichier est la source unique des consignes pour tous les agents (Codex, Claude Code, et les autres).

## Où lire quoi, avant d'agir

| Tâche | À lire d'abord |
| --- | --- |
| Reprendre après une pause ou un autre agent | `git status --short`, `git log -1` |
| Comprendre le projet | [README.md](README.md) |
| Installer, lancer, tester | [INSTALL.md](INSTALL.md) |
| Créer un ticket, nommer une branche, écrire un commit, ouvrir une PR | [CONTRIBUTING.md](CONTRIBUTING.md) |
| Écrire du code | [GUIDELINES.md](GUIDELINES.md) |
| Board, sprints, rôles, réglages GitHub | [docs/gestion-de-projet.md](docs/gestion-de-projet.md) |
| Branches et versions | [docs/strategie-de-branches.md](docs/strategie-de-branches.md) |
| Déployer, publier une version | [docs/deploiement.md](docs/deploiement.md) |

## Commandes

| But | Commande |
| --- | --- |
| Lint Markdown, comme la CI | `npx --yes markdownlint-cli2@0.23.3 "**/*.md" "!node_modules" "!.github/pull_request_template.md"` |

Les liens se vérifient dans la CI (`lychee`). Les adresses du dépôt et du board, privés, sont exclues dans `.lycheeignore`.

## Board

Le board est le projet n° 1 de l'organisation `Coordination-Front-Back-M2-TP` (GitHub Projects). Il faut gh 2.94 ou plus, avec le droit `project` : `gh auth refresh -s project`.

- Un ticket reprend le titre, le label et les rubriques de son gabarit (`.github/ISSUE_TEMPLATE/`), par exemple `[US] …` avec le label `type: user-story`.
- Le créer sous son parent (EPIC, user story) : `gh issue create --parent NUMERO_PARENT`. Rattacher un ticket existant : `gh issue edit NUMERO_PARENT --add-sub-issue NUMERO_ENFANT`.
- S'il n'arrive pas seul sur le board : `gh project item-add 1 --owner Coordination-Front-Back-M2-TP --url <adresse de l'issue>`.
- Remplir `Estimation` et `Priorité` : `gh project field-list 1 --owner Coordination-Front-Back-M2-TP` donne les identifiants, `gh project item-edit` pose la valeur.

## Règles d'or

1. Ne rien inventer : produit, stack, membres, rôles, dates de sprint, consignes du prof. Une information inconnue reste `[[à remplir]]` ou devient une question.
2. Aucun secret dans le dépôt : jeton, mot de passe, fichier `.env`.
3. Tout changement passe par une issue, une branche et une PR relue. Le dépôt est privé sur le plan gratuit : aucun verrou technique ne protège `main`, la règle repose sur l'équipe.
4. Commiter, pousser, créer, modifier ou fermer un ticket seulement à la demande d'un membre de l'équipe.
5. Documentation et commentaires en français.
