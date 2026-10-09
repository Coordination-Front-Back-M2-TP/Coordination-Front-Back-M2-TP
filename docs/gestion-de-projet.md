# Gestion de projet

Ce document décrit comment le projet est découpé, planifié et suivi. Le travail au quotidien (issues, branches, PR) est dans [CONTRIBUTING.md](../CONTRIBUTING.md).

## 1. Découpage : EPIC, user story, tâche

| Niveau | Question à laquelle il répond | Taille | Exemple (fictif, à remplacer) |
| --- | --- | --- | --- |
| EPIC | Quel grand objectif on vise ? | Plusieurs sprints | « Gérer les réservations » |
| User story | Qu'est-ce que l'utilisateur peut faire ? | Un sprint ou moins, 8 points au maximum | « En tant que visiteur, je veux voir les créneaux libres, afin de choisir une date » |
| Tâche | Qu'est-ce que l'équipe doit faire concrètement ? | Une à deux journées de travail | « Créer la route qui renvoie les créneaux libres » |

Règles :

- Une user story décrit un besoin, pas une technique. Si elle parle d'une technique (« utiliser une base de données particulière »), c'est une tâche.
- Une user story rattachée à aucun EPIC attend son rattachement avant d'entrer dans un sprint.
- Une user story qui dépasse 8 points se découpe en plusieurs user stories.
- Un EPIC ne se code pas directement. Il est fini quand toutes ses user stories le sont.

## 2. Board

Le board : [TP Coordination Front&Back](https://github.com/orgs/Coordination-Front-Back-M2-TP/projects/1), sur GitHub Projects. Il est privé : seuls les membres de l'organisation et les personnes invitées le voient.

Il utilise le champ `Status`. Ses colonnes :

| Colonne | Une issue est dans cette colonne quand |
| --- | --- |
| Backlog | Elle est créée, mais elle n'est pas encore prête |
| Prêt | Elle respecte la Definition of Ready et attend un sprint |
| En cours | Quelqu'un est assigné et travaille dessus |
| En revue | Une PR est ouverte et attend une relecture |
| Terminé | L'issue est fermée, la PR est mergée |

Ses vues :

| Vue | Ce qu'elle montre |
| --- | --- |
| Backlog | Les tickets pas encore terminés, en tableau |
| Board | Les colonnes ci-dessus |
| Sprint 1 | Le board du sprint en cours (filtre sur la milestone) |
| EPIC | Les EPIC et l'avancement de leurs sous-issues |

Ses champs, en plus de `Status` :

- `Estimation` : en points (1, 2, 3, 5, 8), comme dans le gabarit de user story.
- `Priorité` : Haute, Moyenne, Basse.
- `Labels` : `type:`, `zone:` et `statut: bloqué` (voir [CONTRIBUTING.md](../CONTRIBUTING.md), section 13).
- `Milestone` : le sprint.
- `Parent issue` et `Sub-issues progress` : la hiérarchie EPIC, user story, tâche.

## 3. Sprints

Un sprint est une milestone GitHub, nommée « Sprint 1 », « Sprint 2 », etc. La durée se fixe avec l'équipe et le prof.

- **Planification** : on prend dans « Prêt » les user stories que l'équipe peut tenir, mesurées en points. On leur affecte la milestone du sprint.
- **Revue** : on montre ce qui est terminé. Ce qui ne l'est pas repart dans le sprint suivant, avec une note sur la raison.
- **Rétrospective** : trois questions. Qu'est-ce qui a bien marché ? Qu'est-ce qui a bloqué ? Qu'est-ce qu'on change au prochain sprint ? La décision se note dans une issue ou dans ce dossier.

## 4. Indicateurs

- **Avancement du sprint** : la barre de progression de la milestone (issues fermées sur total).
- **Vélocité** : total des points des user stories terminées pendant le sprint. Elle sert à planifier le sprint suivant, pas à juger une personne.
- **Blocages** : les issues avec le label `statut: bloqué`. Elles se regardent au début de chaque sprint.

## 5. Rôles

À remplir avec l'équipe.

| Rôle | Personne | Responsabilité |
| --- | --- | --- |
| Product owner | À définir | Ordonne le backlog, valide les user stories |
| Coordination | À définir | Anime la planification, la revue et la rétrospective, lève les blocages |
| Front | À définir | Tâches de la zone `front` |
| Back | À définir | Tâches de la zone `back` |

## 6. Mise en place (une fois)

Ces réglages ne sont pas dans le code : ils se font sur GitHub. La mention « fait le » indique ce qui est déjà en place.

1. **Réglages du dépôt** (fait le 09/10/2026) : `main` reste la branche par défaut (sinon `Closes #` ne ferme pas les issues). Seul le merge en squash est permis, avec le titre de la PR comme message, et la branche est supprimée après le merge. Les environnements `staging` et `production` existent : ils porteront leurs propres variables et secrets. Le pourquoi de ces choix : [strategie-de-branches.md](strategie-de-branches.md).
2. **Règle de branche sur `main`** : le dépôt est privé et l'organisation est sur le plan gratuit, qui ne permet pas de règle de branche sur un dépôt privé. La règle « tout passe par une PR relue, CI verte » est donc une règle d'équipe : personne ne pousse sur `main`, personne ne merge une PR rouge. Si le dépôt passe en public ou l'organisation sur le plan Team : Settings, Rules ou Branches, activer la PR obligatoire, une approbation minimum, et les contrôles requis « Titre au format Conventional Commits », « Issue liée », « Markdown (markdownlint) », « Liens cassés (lychee) ».
3. **Board** (fait le 09/10/2026) : projet n° 1 de l'organisation, relié au dépôt. Colonnes, champs et vues décrits à la section 2.
4. **Workflows du board** (à faire à la main : l'API de GitHub ne permet pas de les activer). Dans le projet, menu `…`, Workflows :
   - « Auto-add to project » : choisir ce dépôt, filtre `is:issue,pr is:open`. Chaque nouvelle issue et PR arrive sur le board, sans jeton à gérer.
   - « Item added to project » : Status sur Backlog.
   - « Pull request linked to issue » : Status sur En revue.
   - « Item closed » et « Pull request merged » : Status sur Terminé.
   - « Auto-add sub-issues to project » : déjà actif. Les sous-issues d'un ticket du board y entrent aussi.
5. **Ajout au board par GitHub Actions** (facultatif) : le job « Ajouter au board » de [.github/workflows/issues.yml](../.github/workflows/issues.yml) fait la même chose que « Auto-add to project ». Il est sauté tant que la variable de dépôt `PROJECT_URL` n'existe pas. Pour s'en servir : créer un jeton avec le droit d'écriture sur les projets, le stocker en secret Actions sous le nom `PROJECT_TOKEN` (jamais dans le dépôt), puis créer `PROJECT_URL` avec l'adresse du board.
6. **Milestones** (« Sprint 1 » créée le 09/10/2026, sans date) : créer les suivantes au fil des sprints, dans l'onglet Issues, Milestones. Fixer les dates avec l'équipe.
7. **Labels** : après le premier push sur `main`, vérifier dans l'onglet Actions que « Synchroniser les labels » a tourné. Sinon, le lancer une fois (Run workflow).
8. **Membres** : inviter les membres de l'équipe dans l'organisation. Le prof est invité en collaborateur externe, en lecture, sur le dépôt et sur le board.
