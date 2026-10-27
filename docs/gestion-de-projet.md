# Gestion de projet

Ce document décrit comment le projet est découpé, planifié et suivi. Le travail au quotidien (issues, branches, PR) est dans [CONTRIBUTING.md](../CONTRIBUTING.md).

## 1. Découpage : EPIC, user story, tâche

| Niveau | Question à laquelle il répond | Taille | Exemple dans P1X3L |
| --- | --- | --- | --- |
| EPIC | Quel grand objectif on vise ? | Plusieurs sprints | « Découvrir la toile » (#14) |
| User story | Qu'est-ce que l'utilisateur peut faire ? | Un sprint ou moins, 8 points au maximum | « En tant que visiteur ou joueur, je veux voir la toile se mettre à jour en direct, afin de suivre la bataille sans recharger la page » (#15) |
| Tâche | Qu'est-ce que l'équipe doit faire concrètement ? | Une à deux journées de travail | « Afficher la toile et ses mises à jour en direct » (#34) |

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

Une tâche suit sa user story jusqu'au sprint : elle passe en Prêt en même temps qu'elle, et entre dans le même sprint. Ensuite elle avance seule : En cours quand quelqu'un se l'assigne, En revue quand sa PR est ouverte, Terminé au merge. Une tâche sans user story (réglage, documentation) passe en Prêt quand sa description et son critère de fin sont écrits.

Un parent avance avec ses enfants. Un EPIC passe en Prêt dès qu'une de ses user stories est prête. Une user story ou un EPIC passe en En cours dès que le premier de ses enfants commence, et en Terminé quand on le ferme, une fois tous ses enfants terminés. Aucun workflow ne fait ces changements de parent : la personne qui fait avancer l'enfant met le parent à jour.

Ses vues :

| Vue | Ce qu'elle montre |
| --- | --- |
| Backlog | Les issues ouvertes pas encore terminées, en tableau (filtre `is:issue is:open`) |
| Board | Les issues seulement, dans les colonnes ci-dessus (filtre `is:issue`) |
| Sprint 2 | Les issues du sprint en cours (filtre `is:issue milestone:"Sprint 2"`) |
| EPIC | Les EPIC et l'avancement de leurs sous-issues (filtre `is:issue label:"type: epic"`) |
| Story map | Les user stories, en colonnes par activité et en lignes par tranche (filtre `is:issue label:"type: user-story"`), comme dans la [story map](story-map.md) |
| Mes tickets | Les tickets assignés à la personne connectée, dans les colonnes du board (filtre `assignee:@me`) |

Ses champs, en plus de `Status` :

- `Estimation` : en points (1, 2, 3, 5, 8), comme dans le gabarit de user story.
- `Priorité` : Haute, Moyenne, Basse.
- `Activité` : l'EPIC du ticket, c'est-à-dire sa colonne dans la story map.
- `Tranche` : « 1 : démo du TP », « 2 : après la démo » ou « Option ». C'est la ligne du ticket dans la story map. Une tâche reprend l'activité et la tranche de sa user story.
- `Labels` : `type:`, `zone:` et `statut: bloqué` (voir [CONTRIBUTING.md](../CONTRIBUTING.md), section 13).
- `Milestone` : le sprint.
- `Parent issue` et `Sub-issues progress` : la hiérarchie EPIC, user story, tâche.

### Dépendances et orchestration

Une dépendance signifie qu'une issue ne peut pas être considérée comme terminée avant une autre. Relier la tâche bloquée à son prérequis avec la relation GitHub **Blocked by** ; par exemple, « Front : afficher la toile » (#34) est bloquée par le contrat (#33). La relation apparaît dans les deux sens : #33 bloque #34, et #34 est bloquée par #33. Ne pas relier deux tâches seulement parce qu'elles appartiennent à la même user story.

Une issue peut être en Prêt tout en attendant un prérequis non terminé : le statut dit qu'elle est planifiable, la relation **Blocked by** dit ce qu'elle attend. GitHub l'affiche par une icône sur la carte, sans label à ajouter. Quand on planifie une user story, ses prérequis entrent dans le même sprint ou dans un sprint précédent.

Le label `statut: bloqué` est réservé à un ticket du sprint qui ne peut pas avancer et attend une action : une décision, ou un prérequis qui n'est dans aucun sprint. Il se retire dès que l'action est faite.

Les dépendances entre user stories retenues sont :

- #16 est bloquée par #15 ; #19 par #18.
- #21 est bloquée par #15 et #18 ; #22 par #21.
- #24 est bloquée par #15 et #18 ; #25 par #24 et #22 ; #26 par #24.
- #28 est bloquée par #19 et #21 ; #29 par #21.
- #31 est bloquée par #18 et #21 ; #32 par #31 (rôle admin) et #21 (historique des poses).
- La story de badges #108, encore au backlog et à affiner, est bloquée par #18 et #21.

Pour le Sprint 2, les dépendances entre tâches retenues sont :

- #34 et #35 sont bloquées par leur contrat #33 ; #43 et #44 sont bloquées par leur contrat #42. Les contrats peuvent ainsi être relus avant que le front et le back avancent en parallèle.
- La tâche de tests #95 dépend de la livraison front #43 et back #44 pour valider le parcours intégré.

Le board ne lance ni ne parallélise le travail automatiquement : il rend les prérequis visibles, mais l'équipe doit décider de l'ordre, vérifier les contrats et lever les blocages. Les tests unitaires peuvent être préparés en parallèle ; la validation intégrée attend les fonctionnalités dont elle dépend.

## 3. Sprints

Un sprint est une milestone GitHub, nommée « Sprint 1 », « Sprint 2 », etc. Il va d'un cours au suivant : la milestone a pour échéance la date du cours qui termine le sprint.

| Sprint | Du | Au |
| --- | --- | --- |
| Sprint 0 | Vendredi 9 octobre 2026 | Vendredi 9 octobre 2026 |
| Sprint 1 | Vendredi 9 octobre 2026 | Mardi 27 octobre 2026 |
| Sprint 2 | Mardi 27 octobre 2026 | Mardi 17 novembre 2026 |
| Sprint 3 | Mardi 17 novembre 2026 | Jeudi 19 novembre 2026 |

Le Sprint 0 est la séance du TD POC : la mise en place du projet. Le Sprint 3 ne dure que deux jours, mais l'équipe travaille surtout pendant les cours.

- **Planification** : on prend dans « Prêt » les user stories que l'équipe peut tenir, mesurées en points. On leur affecte la milestone du sprint.
- **Revue** : on montre ce qui est terminé. Ce qui ne l'est pas repart dans le sprint suivant, avec une note sur la raison.
- **Rétrospective** : trois questions. Qu'est-ce qui a bien marché ? Qu'est-ce qui a bloqué ? Qu'est-ce qu'on change au prochain sprint ? La décision se note dans une issue ou dans ce dossier.
- **Changement de sprint** : fermer la milestone du sprint fini. Dans le board, modifier le filtre de la vue du sprint courant pour la milestone suivante, puis renommer la vue.

Pour le TD « Road to MVP », la répartition prévue respecte la consigne d'une story fullstack pour l'équipe et d'une pour le stagiaire : #15 « Voir la toile en direct » est portée par l'équipe ; #21 « Poser un pixel » est proposée au stagiaire. Le compte du stagiaire étant à confirmer à son arrivée, ne pas l'assigner à l'avance. La story #21 dépend aussi de #18 « Créer un compte et se connecter » : le 27/10/2026, le product owner a ajouté #18 et ses tâches au Sprint 2 pour que #21 puisse être livrée en entier.

## 4. Indicateurs

- **Avancement du sprint** : la barre de progression de la milestone (issues fermées sur total).
- **Vélocité** : total des points des user stories terminées pendant le sprint. Elle sert à planifier le sprint suivant, pas à juger une personne.
- **Blocages** : les issues avec le label `statut: bloqué`. Elles se regardent au début de chaque sprint.

## 5. Rôles

| Rôle | Personne | Responsabilité |
| --- | --- | --- |
| Product owner | Lucas | Ordonne le backlog, valide les user stories |
| Coordination | Théo | Anime la planification, la revue et la rétrospective, lève les blocages |
| Tech lead front | Théo | Tranche les choix techniques du front, relit en priorité les PR de la zone `front` |
| Tech lead back | Swan | Tranche les choix techniques du back, relit en priorité les PR de la zone `back` |

Tout le monde développe, Lucas compris, sur le front comme sur le back : qui prend quelle tâche se décide à la planification du sprint. Le tech lead est la référence de sa zone, pas son seul développeur. Personne ne relit sa propre PR : une PR front de Théo est relue par Swan ou Lucas.

## 6. Mise en place (une fois)

Ces réglages ne sont pas dans le code : ils se font sur GitHub. La mention « fait le » indique ce qui est déjà en place.

1. **Réglages du dépôt** (fait le 09/10/2026) : `main` reste la branche par défaut (sinon `Closes #` ne ferme pas les issues). Seul le merge en squash est permis, avec le titre de la PR comme message, et la branche est supprimée après le merge. Les environnements `staging` et `production` existent : ils gardent l'historique des déploiements. Le plan gratuit ne donne pas accès aux secrets d'environnement sur un dépôt privé : les secrets et variables du déploiement sont au niveau du dépôt (voir [deploiement.md](deploiement.md)). Le pourquoi de ces choix : [strategie-de-branches.md](strategie-de-branches.md).
2. **Règle de branche sur `main`** : le dépôt est privé et l'organisation est sur le plan gratuit, qui ne permet pas de règle de branche sur un dépôt privé. La règle « tout passe par une PR relue, CI verte » est donc une règle d'équipe : personne ne pousse sur `main`, personne ne merge une PR rouge. Le contrôle « Relecture approuvée » la rend visible : son job échoue tant qu'un autre membre n'a pas approuvé. Sur une PR issue d'un fork, il lit les avis avec un jeton en lecture seule, sans écrire de statut. Si le dépôt passe en public ou l'organisation sur le plan Team : Settings, Rules ou Branches, activer la PR obligatoire, une approbation minimum, et les contrôles requis « Titre au format Conventional Commits », « Issue liée », « Description complète », « Relecture approuvée », « CI terminée », « Markdown (markdownlint) », « Liens cassés (lychee) ».
3. **Board** (fait le 09/10/2026) : projet n° 1 de l'organisation, relié au dépôt. Colonnes, champs et vues décrits à la section 2. La vue Story map se règle dans View : Board, Column by `Activité`, Swimlanes `Tranche`, filtre `is:issue label:"type: user-story"`.
4. **Workflows du board** (réglés à la main : l'API de GitHub ne permet pas de les activer). Dans le projet, menu `…`, Workflows :
   - « Auto-add to project » : ce dépôt, filtre `is:issue is:open` (modifié le 27/10/2026 : l'ancien filtre `is:issue,pr is:open` ajoutait aussi les PR). Seules les issues ouvertes arrivent sur le board, sans jeton à gérer. Une PR se lit dans « Linked pull requests » sur son issue ; « Pull request linked to issue » continue de passer l'issue en revue.
   - « Item added to project » : Status sur Backlog.
   - « Pull request linked to issue » : Status sur En revue.
   - « Item closed » et « Pull request merged » : Status sur Terminé.
   - « Auto-add sub-issues to project » : éteint. Il s'est désactivé quand « Auto-add to project » a été activé. Ce n'est pas gênant : une sous-issue est une issue du dépôt, « Auto-add to project » l'ajoute déjà.
   - « Auto-close issue » : laissé éteint. Il fermerait une issue glissée dans Terminé avant le merge de sa PR. C'est le `Closes #` de la PR qui ferme l'issue, au merge.
5. **Ajout au board par GitHub Actions** (facultatif) : le job « Ajouter au board » de [.github/workflows/issues.yml](../.github/workflows/issues.yml) fait la même chose que « Auto-add to project », mais il ajoute aussi les PR : avant de l'activer, le limiter aux issues (`github.event_name == 'issues'`). Il est sauté tant que la variable de dépôt `PROJECT_URL` n'existe pas. Pour s'en servir : créer un jeton avec le droit d'écriture sur les projets, le stocker en secret Actions sous le nom `PROJECT_TOKEN` (jamais dans le dépôt), puis créer `PROJECT_URL` avec l'adresse du board.
6. **Milestones** (fait le 10/10/2026) : « Sprint 0 » à « Sprint 3 », datées comme à la section 3. « Sprint 0 » est l'ancienne « Sprint 1 », créée le 09/10/2026 : elle regroupe la mise en place du TD POC et elle est fermée. S'il faut un sprint de plus : onglet Issues, Milestones.
7. **Labels** : après le premier push sur `main`, vérifier dans l'onglet Actions que « Synchroniser les labels » a tourné. Sinon, le lancer une fois (Run workflow).
8. **Déploiement** : quand l'hébergement est choisi, créer ses secrets et variables Actions, listés dans [deploiement.md](deploiement.md). D'ici là, le workflow « Déploiement continu » tourne sans rien déployer.
9. **Membres** (fait) : les membres de l'équipe sont dans l'organisation, et le prof a accès au dépôt et au board.
