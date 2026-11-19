# Contribuer à P1X3L

P1X3L est une pixel war en équipes, en temps réel, où une IA propose des modèles à dessiner. Ce guide s'adresse à l'équipe 3L1K0PT3R et au prof : il décrit comment on travaille ensemble, du ticket au merge.

Règle de base : rien n'arrive directement sur `main`. Chaque changement passe par une issue, une branche et une pull request relue.

## 1. Avant de commencer

- Lire le [README.md](README.md) pour comprendre le projet.
- Installer le projet avec [INSTALL.md](INSTALL.md).
- Lire [GUIDELINES.md](GUIDELINES.md) avant d'écrire du code.
- Avoir accès au dépôt et au board : [TP Coordination Front&Back](https://github.com/orgs/Coordination-Front-Back-M2-TP/projects/1). Les contributeurs en lecture seule travaillent depuis un fork ; voir « Contribuer depuis un fork ».
- Respecter le code de conduite : respect, pas de jugement, retours précis et courtois.
- Si un agent IA travaille sur le dépôt, il lit `AGENTS.md`.

## 2. Contributions attendues

- Du code : nouvelle fonctionnalité ou correction.
- De la documentation, des tests, des retours de test.
- Du tri de tickets : reformuler, découper, rattacher à un EPIC.

Pas dans les issues : les questions d'usage. Les poser sur le Discord de l'équipe.

## 3. Installer et lancer le projet

Tout est dans [INSTALL.md](INSTALL.md) : prérequis, configuration, lancement, tests et lint.

## 4. Le flux de travail en bref

1. Créer l'issue avec le bon gabarit (section 5).
2. Vérifier qu'elle est prête (section 6).
3. S'assigner l'issue et la passer en « En cours » sur le board, si l'on dispose des droits nécessaires. Un contributeur en lecture seule demande au tuteur de mettre à jour l'issue et le board.
4. Créer une branche (section 7).
5. Commiter par petites étapes (section 8).
6. Ouvrir une pull request avec `Closes #numéro` (section 9).
7. Passer la CI et la relecture (section 10).
8. Merger en squash. L'issue se ferme et le board passe à « Terminé ».

### Cycle de vie d'un ticket

Les statuts sont les options du champ `Status` du board.

| Statut | Le ticket est ici quand | Il passe au suivant quand |
| --- | --- | --- |
| Backlog | Il est créé, mais pas encore prêt | La Definition of Ready est remplie (section 6) |
| Prêt | Il attend un sprint, ou que la personne assignée commence | La personne assignée commence et crée sa branche |
| En cours | Quelqu'un travaille dessus, sur sa branche | Une PR est ouverte |
| En revue | La PR attend une relecture | La PR est approuvée et mergée |
| Terminé | Le merge a fermé l'issue | Fin du cycle |

Une tâche passe en Prêt avec sa user story. Une user story ou un EPIC passe en En cours dès que le premier de ses enfants commence. Le détail est dans [docs/gestion-de-projet.md](docs/gestion-de-projet.md), section 2.

## 5. Issues

Chaque travail a une issue. Utiliser le bon gabarit (bouton « New issue ») :

| Gabarit | Sert à | Titre | Label |
| --- | --- | --- | --- |
| EPIC | Un grand objectif qui regroupe des user stories | `[EPIC]` | `type: epic` |
| User story | Une fonctionnalité vue par l'utilisateur | `[US]` | `type: user-story` |
| Tâche | Un travail technique pour une user story | `[Tâche]` | `type: tâche` |
| Bug | Un comportement qui ne correspond pas à ce qui est attendu | `[Bug]` | `type: bug` |

Une EPIC contient des user stories, une user story contient des tâches. Les relier avec les sous-issues de GitHub : dans le parent, bouton « Create sub-issue » ou « Add existing issue ». Un parent accepte jusqu'à 100 sous-issues, sur 8 niveaux au maximum ([doc GitHub](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/adding-sub-issues)).

En ligne de commande, avec gh 2.94 ou plus :

| But | Commande |
| --- | --- |
| Créer une issue sous son parent | `gh issue create --parent NUMERO_PARENT` |
| Rattacher une issue existante | `gh issue edit NUMERO_PARENT --add-sub-issue NUMERO_ENFANT` |

Règles :

- Une issue traite un seul sujet. Chercher avant de créer : elle existe peut-être déjà.
- Une user story estimée à plus de 8 points se découpe.
- Une tâche tient en une à deux journées de travail. Au-delà, la découper.

Une user story suit ce format :

> En tant que [rôle], je veux [besoin], afin de [bénéfice].

Les critères d'acceptation disent comment savoir qu'elle est finie. Chacun se vérifie : « Étant donné…, quand…, alors… », ou une case à cocher.

Un bug se signale avec le gabarit Bug : comportement attendu, comportement constaté, étapes pour reproduire, contexte. Une faille de sécurité ne s'ouvre pas en issue : la signaler en message privé à un membre de l'équipe, sur Discord.

## 6. Une issue est prête (Definition of Ready)

Une user story entre dans un sprint seulement si :

- le rôle, le besoin et le bénéfice sont écrits ;
- les critères d'acceptation sont testables ;
- elle a une estimation en points et une priorité ;
- elle est rattachée à un EPIC ;
- ses dépendances sont connues et les tickets bloquants sont reliés dans GitHub quand c'est possible (voir [docs/gestion-de-projet.md](docs/gestion-de-projet.md)).

## 7. Stratégie de branches et versions

### Branches

Notre flow : tronc unique, branches courtes, déploiement à chaque merge. Le pourquoi (contexte, critères, comparaison avec Git Flow, GitHub flow, GitLab Flow, trunk-based et Release Flow) est dans [docs/strategie-de-branches.md](docs/strategie-de-branches.md).

- `main` est la seule branche longue, toujours déployable, et la branche par défaut. Personne n'y pousse directement.
- Une branche courte par issue, partie de `main`, tenue par une personne, deux jours au plus. Au-delà, l'issue est trop grosse : la découper.
- La branche se fusionne dans `main` par PR en squash, puis elle est supprimée.
- Le travail pas fini part dans `main` caché derrière un flag de configuration, jamais dans une branche longue.
- Chaque merge sur `main` part en production, une fois la CI de `main` verte. Merger, c'est mettre en production.
- Correctif urgent : PR `fix/…` sur `main`, ou PR de revert du commit fautif.

Format du nom : `type/numéro-description-courte`, en minuscules, avec des tirets, sans accents ni espaces.

Exemples : `feat/43-palette-et-pose`, `fix/46-delai-verifie-par-le-serveur`, `docs/66-nom-equipe-board`.

### Versions

La version en production est un commit de `main` : `/api/health` le renvoie, et chaque image publiée garde un tag `sha-<commit>` ([docs/deploiement.md](docs/deploiement.md)).

Il n'y a plus de numéro de version ni de tag à poser. Les tags `v0.1.0`, `v0.1.1` et `v0.2.0` datent de l'ancien flow et restent dans l'historique. Le type du commit (section 8) dit toujours ce qui change : `feat` ajoute, `fix` corrige, et un `!` après le type (ou `BREAKING CHANGE:` dans le corps) casse la compatibilité.

## 8. Messages de commit et titres de PR

Le format suit [Conventional Commits](https://www.conventionalcommits.org/fr/v1.0.0/) :

```text
type: description
type(zone): description
```

Types acceptés : `feat`, `fix`, `docs`, `ci`, `chore`, `refactor`, `test`, `style`, `perf`, `build`, `revert`. Zones du projet : `front`, `back`, `transverse`.

La description est en français, à l'impératif, sans point final. Exemples :

- `feat(front): ajouter la palette de couleurs`
- `fix(back): refuser un pixel posé avant la fin du délai`
- `docs: décrire le processus de revue`

Le titre de la PR devient le message du commit final (squash). Il suit donc le même format.

Un hook Git vérifie chaque message de commit en local, avant même le push : un commit hors format est refusé, avec le lien vers cette section. Il s'installe tout seul avec `npm ci` à la racine du dépôt ([INSTALL.md](INSTALL.md), section 4). Ses règles, dans [commitlint.config.mjs](commitlint.config.mjs), sont celles du contrôle « Titre au format Conventional Commits » des PR : les 11 types ci-dessus, une description non vide, sans point final. En cas d'urgence, `git commit --no-verify` saute le hook ; le titre de la PR reste vérifié par la CI.

## 9. Pull requests

- Une PR par issue. Une PR courte se relit mieux : si elle grossit, la découper.
- La description contient une ligne `Closes #numéro`. Le merge ferme l'issue tout seul.
- Compléter le gabarit de PR, section par section : description, issue liée, un seul type (celui du titre), Definition of Done entièrement cochée. Le contrôle « Description complète » dit ce qui manque.
- Une PR est approuvée par un autre membre de l'équipe que son auteur. Le contrôle « Relecture approuvée » reste rouge jusque-là, et aussi tant qu'un relecteur demande des modifications.
- Ne pas merger si un contrôle est rouge. Le dépôt privé du plan gratuit ne permet pas de règle de branche : rien n'empêche techniquement le merge, la règle repose sur l'équipe.
- Une PR vise `main` et se merge avec « Squash and merge » (section 7).

### Contribuer depuis un fork

Ce flux s'applique notamment au stagiaire, qui a un accès en lecture au dépôt amont et pousse uniquement sur son fork personnel :

1. Créer une branche basée sur la dernière version de `upstream/main` (voir [docs/onboarding.md](docs/onboarding.md)).
2. Pousser la branche sur `origin`, qui doit pointer vers le fork : `git push -u origin <nom-de-branche>`.
3. Ouvrir une PR dont la base est `Coordination-Front-Back-M2-TP/Coordination-Front-Back-M2-TP:main` et la source `<compte-github>:<nom-de-branche>`.
4. Remplir le gabarit de PR et demander une relecture à l'équipe, comme pour toute autre PR.

Ne pas essayer de pousser sur `upstream` : l'accès en lecture seule est intentionnel. Le stagiaire lit aussi le board en lecture seule, et le tuteur lui assigne ses tickets ([docs/onboarding.md](docs/onboarding.md), section 2).

### Relire une PR de fork

Un contributeur en lecture seule ne peut rien casser seul : le seul risque est qu'on merge une PR piégée. Ce qui est mergé part en production dans les minutes qui suivent. En plus de la section 10, le relecteur vérifie :

- **Les fichiers sensibles**, lus ligne à ligne : `.github/` (workflows, gabarits, labels), `AGENTS.md`, `package.json` et `package-lock.json`, `front/Dockerfile`, `back/Dockerfile` et `front/nginx.conf`. Un changement sans rapport avec le ticket est refusé.
- **L'issue liée** : une seule ligne `Closes`, vers le ticket du contributeur. Au merge, chaque `Closes #numéro` ferme l'issue citée.
- **Les dépendances, avant de lancer la PR en local** : une nouvelle dépendance ou un script `postinstall` s'exécute sur la machine du relecteur, avec ses accès GitHub. Tant que le diff n'est pas lu, installer avec `npm ci --ignore-scripts`.
- **Les workflows, avant de cliquer sur « Approve and run »** : GitHub demande cette approbation avant de lancer la CI d'une PR de fork. La CI tourne alors sans secret et avec un jeton en lecture, mais elle exécute la version des workflows de la PR.
- **Avant de merger** : le merge met la PR en production. C'est la dernière vérification.

## 10. Revue de code

- Qui relit : au moins une personne de l'équipe autre que l'auteur, qui approuve la PR (« Approve »). Seule l'approbation d'une personne qui a le droit d'écriture sur le dépôt compte.
- Délai de relecture : pendant une séance du cours, sur le moment. En dehors des séances, pas de délai fixe, tant que la PR est relue avant le cours suivant.
- Ce qu'on regarde : les critères d'acceptation, le respect de [GUIDELINES.md](GUIDELINES.md), la lisibilité, les tests, la documentation, l'absence de secret.
- Un commentaire est précis et courtois, et il dit pourquoi. L'auteur répond ou corrige. Le relecteur résout ses propres fils.
- Qui merge : le relecteur, après son approbation. Personne ne merge sans relecture.

## 11. Qualité du code

Les conventions de code (structure, nommage, contrat entre le front et le back, tests, sécurité) sont dans [GUIDELINES.md](GUIDELINES.md). La CI vérifie le lint et les tests : ne pas merger si elle échoue.

La CI ([.github/workflows/ci.yml](.github/workflows/ci.yml)) traite chaque dossier qui contient un `package.json` commité, à la racine comme dans un sous-dossier (`front/`, `back/`…) :

- elle exige le `package-lock.json` du dossier, puis installe avec `npm ci` ;
- elle lance `npm run lint`, `npm test` et `npm run build`, chacun seulement si le script existe dans le `package.json` ;
- le dossier `e2e/` est traité à part, dans le job « Tests E2E (Playwright) » : ses tests ont besoin du navigateur Chromium, installé par `npx playwright install --with-deps chromium` ;
- le contrôle « CI terminée » résume tous les dossiers : c'est lui qu'il faut regarder ;
- un nouveau push sur une PR annule le run précédent de cette PR (`concurrency`) : c'est normal de voir un run « Cancelled » remplacé par un plus récent. Un run sur `main` n'est jamais annulé ;
- chaque job a une durée maximale (`timeout-minutes`) : 5 minutes pour les petits jobs, 10 pour lint, tests et build, 15 pour les tests E2E. Un job qui dépasse s'arrête en échec : chercher ce qui bloque (installation, serveur de test qui ne démarre pas) plutôt que d'augmenter la limite.

La CI n'a volontairement pas de filtre `paths:` : le contrôle « CI terminée » doit exister sur chaque PR, même une PR qui ne touche que la documentation.

Le script `test` créé par `npm init` échoue exprès (« no test specified ») : le remplacer par la vraie commande de test.

## 12. Une issue est finie (Definition of Done)

Une user story est terminée quand :

- ses critères d'acceptation sont vérifiés ;
- la PR est relue, mergée, et la CI est verte ;
- la documentation est à jour ([README.md](README.md) ou `docs/`) si le comportement change ;
- toutes ses tâches sont fermées.

Un EPIC est terminé quand toutes ses user stories le sont.

## 13. Labels

- `type:` : `epic`, `user-story`, `tâche`, `bug`.
- `zone:` : `front`, `back`, `transverse`. Le workflow les pose à partir du champ « Zone » du gabarit.
- `statut: bloqué` : quand un ticket du sprint ne peut pas avancer et attend une action (une décision, un prérequis qui n'est dans aucun sprint). Expliquer le blocage dans un commentaire. Une simple dépendance se note avec la relation « Blocked by », sans label.

Les labels viennent de [.github/labels.yml](.github/labels.yml). Ne pas les créer à la main : le workflow de synchronisation les applique depuis ce fichier.

## 14. Ce qui se fait tout seul

| Quand | Ce qui se passe | Où |
| --- | --- | --- |
| Un commit est créé en local | Son message est vérifié ; il est refusé s'il ne suit pas le format de la section 8 | [.husky/commit-msg](.husky/commit-msg) et [commitlint.config.mjs](commitlint.config.mjs) |
| Une issue est créée ou modifiée | Le label de zone est posé ou mis à jour | [.github/workflows/issues.yml](.github/workflows/issues.yml) |
| Une PR est ouverte ou modifiée | Le titre, l'issue liée et le gabarit rempli sont vérifiés | [.github/workflows/pr-checks.yml](.github/workflows/pr-checks.yml) |
| Une PR est ouverte, modifiée ou relue | Le job « Relecture approuvée » lit les avis et réussit seulement après une approbation valide | [.github/workflows/relecture.yml](.github/workflows/relecture.yml) |
| Du code est poussé dans une PR ou sur `main` | Lint, tests et build de chaque projet Node, et tests E2E (Playwright) | [.github/workflows/ci.yml](.github/workflows/ci.yml) |
| Un fichier Markdown change | Le format et les liens sont vérifiés | [.github/workflows/docs-ci.yml](.github/workflows/docs-ci.yml) |
| Une PR est mergée sur `main` et la CI de `main` est verte | Le commit est déployé en production | [.github/workflows/cd.yml](.github/workflows/cd.yml) |
| `labels.yml` change sur `main` | Les labels du dépôt sont synchronisés | [.github/workflows/labels-sync.yml](.github/workflows/labels-sync.yml) |
| Une issue est créée | Elle arrive sur le board, en Backlog. Une PR n'y arrive pas : elle se lit sur son issue | Workflows intégrés du board |
| Une sous-issue est créée sous un ticket du board | Elle arrive aussi sur le board | Workflows intégrés du board |
| Une PR est liée à une issue | L'issue passe en « En revue » | Workflows intégrés du board |
| Une PR est mergée ou une issue fermée | Le ticket passe en « Terminé » | Workflows intégrés du board |

La mise en place (règles de branche, colonnes, vues et workflows du board) est dans [docs/gestion-de-projet.md](docs/gestion-de-projet.md).

## 15. Communication

- Les questions et les décisions vont dans l'issue concernée, pas en message privé. Une personne absente doit retrouver la trace.
- Une décision importante est aussi notée dans `docs/`.
- Un blocage se signale tout de suite : label `statut: bloqué` et commentaire.
- Autres canaux : le Discord de l'équipe, et les séances du cours.

## 16. Licence et droits

Projet scolaire (Ynov, M2) : pas de licence open source, aucun accord de contribution à signer.
