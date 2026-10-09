# Coordination-Front-Back-M2-TP

Dépôt du TP du cours Ynov M2 « Coordination Front&Back » : une pixel war en équipes, en React avec Vite pour le front, Node.js avec Express et Socket.IO pour le back, SQLite avec Prisma pour les données. Le produit et la pile sont décrits dans le [README.md](README.md). Les cases `[[à remplir]]` qui restent attendent une décision de l'équipe.

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

## Déploiement sur le NAS

L'application est hébergée sur le NAS de Théo, à côté d'autres projets. Ce NAS a ses propres règles, que le code et la CI/CD du projet doivent respecter. Le détail du déploiement est dans [docs/deploiement.md](docs/deploiement.md).

- **Rien ne s'exécute sur le NAS depuis GitHub.** Pas de runner auto-hébergé, pas de hook ni de port ouvert pour déclencher un déploiement : le NAS tire les images, GitHub ne pousse rien vers lui.
- **La CI construit des images Docker et les publie sur GHCR** (`ghcr.io`). Le NAS les récupère avec `docker compose pull`, et le déploiement est lancé à la main. Les images sont privées : le NAS s'y connecte avec un jeton limité à `read:packages`.
- **Une image se désigne par un tag immuable** : le SHA du commit ou la version `vX.Y.Z`. Jamais `latest` en production : il ne dit pas ce qui tourne et ne permet pas de revenir en arrière.
- **Adresse** : un sous-domaine de `theo-stoffelbach.fr` (CNAME chez OVH). Le HTTPS et le routage passent par Nginx Proxy Manager, avec l'option « Websocket Support » cochée, sinon Socket.IO ne marche pas.
- **Conteneurs** : `restart: unless-stopped`, `security_opt: no-new-privileges:true`, des limites CPU et RAM (`deploy.resources.limits`, le NAS est partagé), un `healthcheck`, et un utilisateur non root dans l'image.
- **Réseaux** : aucun port publié sur l'hôte. Le conteneur exposé rejoint le réseau dédié `<app>_public`, où seul Nginx Proxy Manager le retrouve. Tout ce qui ne doit pas être exposé reste sur un réseau `internal: true`.
- **Données** : la base SQLite vit dans un volume persistant, à ajouter aux sauvegardes du NAS.
- **Secrets** : dans un `.env` sur le NAS, en `chmod 600`, jamais dans le dépôt ni dans le `docker-compose.yml`. Pas de valeur par défaut faible (`${MOT_DE_PASSE:-secret}`) : si une variable manque, l'application refuse de démarrer.
- **Mise en place sur le NAS** (réseau, proxy, DNS, certificat) : elle se fait avec Théo, en suivant le guide d'ajout d'une application du NAS. Ces réglages ne sont pas dans ce dépôt.

## Règles d'or

1. Ne rien inventer : produit, stack, membres, rôles, dates de sprint, consignes du prof. Une information inconnue reste `[[à remplir]]` ou devient une question.
2. Aucun secret dans le dépôt : jeton, mot de passe, fichier `.env`.
3. Tout changement passe par une issue, une branche et une PR relue. Le dépôt est privé sur le plan gratuit : aucun verrou technique ne protège `main`. Les contrôles de PR (« Description complète », « Relecture approuvée », « CI terminée »…) restent rouges tant que la PR n'est pas prête, et on ne merge pas une PR rouge.
4. Commiter souvent, par petites étapes. Pousser, ouvrir une PR, créer, modifier ou fermer un ticket seulement avec l'accord de la personne qui pilote l'agent. Une PR par issue, relue par un autre membre de l'équipe : personne ne merge sa propre PR.
5. Ne pas modifier la CI/CD (`.github/workflows/`) ni les personas sans l'accord de la personne qui s'en occupe.
6. Documentation et commentaires en français.
