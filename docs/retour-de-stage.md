# Retours de stage

Ce document rassemble les deux retours sur le stage du TD « Road to MVP » : le rapport du stagiaire et celui du maître de stage. La dernière section croise les deux et liste les actions retenues pour le prochain onboarding.

Le cadre de ces retours est décrit dans [onboarding.md](onboarding.md), section 7.

## Sommaire

1. [Contexte du stage](#1-contexte-du-stage)
2. [Rapport du stagiaire](#2-rapport-du-stagiaire)
3. [Rapport du maître de stage](#3-rapport-du-maître-de-stage)
4. [Synthèse et actions](#4-synthèse-et-actions)

---

## 1. Contexte du stage

| Élément | Détail |
| --- | --- |
| **Période** | Sprint 2, TD « Road to MVP » |
| **User story** | #21 « Poser un pixel » |
| **Contrat** | #42, écrit et relu par l'équipe avant l'arrivée du stagiaire |
| **Tâches confiées** | #43 (front : palette et clic de pose), #44 (back : vérification des coordonnées et de la couleur, enregistrement de la pose), #95 (tests unitaires et scénario E2E de la pose) |
| **État au 19/11/2026** | #43 et #44 sont livrées (PR #124 et #125). Pour #95, les tests unitaires de la pose sont livrés avec ces PR, mais le scénario E2E de pose reste à écrire : la tâche est encore ouverte. |
| **Droits** | Lecture seule sur le dépôt et sur le board ; contributions par PR depuis un fork |

---

## 2. Rapport du stagiaire

### Contexte

Le projet appartient à une organisation GitHub. Le stagiaire n'est pas ajouté comme contributeur : il travaille depuis un fork. Pour choisir une tâche, il consulte son backlog dans l'onglet « Projects » du dépôt.

### Points forts

| Domaine | Point fort |
| --- | --- |
| GitHub | La protection des branches. |
| Code | Aucun problème d'installation, grâce à la documentation en Markdown. |

### Points de friction

| Domaine | Point de friction |
| --- | --- |
| GitHub | Impossible de changer le statut d'une tâche sans demander à un membre de l'équipe. |
| GitHub | Pas d'indicateur de progression sur une tâche : aucun moyen d'indiquer qu'on en est à la moitié, par exemple. |
| Code | Trop de fichiers au même endroit. |

### Pistes d'amélioration

- Mettre en place un Docker Compose multi-stage pour tout lancer d'un coup.
- Ajouter une protection avant le push (par exemple avec Husky) : un hook Git qui bloque le push si le message de commit ne respecte pas la convention.

---

## 3. Rapport du maître de stage

### Ce qui a bien marché

- **L'installation s'est faite sans problème.** Le stagiaire a installé et lancé le projet en suivant [INSTALL.md](../INSTALL.md) et la section « Installation locale » de [onboarding.md](onboarding.md) : fork, clone, installation des dépendances, puis lancement du back et du front. Le guide a fait son travail, et cette étape n'a pas retardé sa prise de poste.
- **Le contrat a été préparé à l'avance.** Comme le contrat #42 était déjà relu, le stagiaire est parti de routes et de messages fixés, sans dépendre des allers-retours avec l'équipe.
- **Le flux fork → PR fonctionne.** Le stagiaire a ouvert ses PR depuis son fork. Quand une PR contenait `Closes #numéro`, le ticket passait seul en « En revue » : c'est ce qui s'est passé pour #43.
- **Le travail s'est fait en parallèle sans risque.** Le stagiaire a avancé en même temps que l'équipe, sans jamais avoir de droit d'écriture sur le dépôt.

### Ce qui n'a pas marché

#### Le stagiaire ne peut pas changer le statut de ses tickets

Le stagiaire avait le rôle Read sur le dépôt et sur le board, et c'était voulu. Avec ce rôle, il ne pouvait ni déplacer une carte, ni s'assigner un ticket, ni ajouter un label. Cela a eu plusieurs effets :

- Les workflows du board ne font avancer un ticket qu'à deux moments : « En revue » quand une PR est liée, et « Terminé » au merge. L'étape « En cours » n'existait donc pas pour lui. Si #44 et #95 étaient en « En cours », c'est parce qu'un membre de l'équipe les avait déplacés à sa place.
- La documentation lui demandait de mettre le label `statut: bloqué` quand il était bloqué. Avec ses droits, il ne pouvait pas le faire : la doc et les droits réels se contredisaient.

#### Le board ne montre pas l'avancement des user stories

Aucun workflow ne fait avancer une user story quand ses tâches avancent. La règle de l'équipe veut que la personne qui fait avancer une tâche mette aussi à jour sa user story. Le stagiaire n'en avait pas le droit, et l'équipe a oublié de le faire à sa place.

Exemple concret : la story #21 « Poser un pixel » était encore en « Prêt », alors que :

- son contrat #42 était terminé ;
- son front #43 était en revue ;
- son back #44 et ses tests #95 étaient en cours.

Les vues du board n'aident pas non plus :

- la vue « Story map » range les cartes par activité et par tranche, mais n'affiche pas leur statut ;
- la vue « Sprint 2 » n'affiche pas la progression des sous-tickets.

Pour savoir où en est une user story, il faut donc ouvrir l'issue elle-même.

### Pourquoi ces problèmes

- **Les droits ont été pensés pour la sécurité, pas pour le travail quotidien.** Le prof avait demandé au stagiaire d'essayer de casser le projet. On a donc limité ses droits au maximum, et on a aligné son rôle sur le board sur celui du dépôt. Or ces deux accès sont indépendants : le stagiaire aurait pu avoir le droit de modifier le board sans pouvoir écrire dans le dépôt.
- **Le processus reposait sur des mises à jour manuelles.** La seule personne qui travaillait sur ces tickets n'avait pas le droit de les faire.
- **Le parcours n'a pas été testé avant l'arrivée du stagiaire.** Personne n'avait essayé le circuit complet avec un compte en lecture seule. On aurait vu ces deux problèmes dès le premier jour.

### Ce qu'on peut améliorer pour un prochain onboarding

1. **Mettre le stagiaire en Write sur le board, en gardant Read sur le dépôt.** Il pourra déplacer ses cartes et remplir les champs, mais toujours pas pousser, fermer une issue ou merger. Le seul risque qui reste est l'archivage d'une carte, ce qui se rattrape facilement.
2. **Désigner une personne qui met à jour les user stories.** Par exemple, le tuteur vérifie le statut des stories de son stagiaire à chaque point d'équipe. À plus long terme, un workflow automatique pourrait faire passer une story en « En cours » dès qu'une de ses tâches démarre. Ce changement touche à la CI : il faut l'accord de la personne qui s'en occupe.
3. **Afficher l'avancement des user stories dans les vues.** Ajouter le statut et la progression des sous-tickets aux vues « Sprint » et « Story map », ou créer une vue « User stories du sprint » groupée par issue parente.
4. **Tester le parcours avant l'arrivée du stagiaire.** Avec un compte en lecture seule : créer une branche, ouvrir une PR depuis un fork, et vérifier que la carte bouge sur le board.
5. **Aligner la documentation sur les droits réels.** Corriger le passage sur le label `statut: bloqué`. Ajouter une section courte qui dit clairement au stagiaire ce qu'il peut faire seul et ce qu'il doit demander à son tuteur.

### Conclusion

Côté technique, l'onboarding a bien marché : le stagiaire a installé le projet sans difficulté, il est parti d'un contrat déjà relu et il a livré ses tâches (#43, #44 et les tests unitaires de #95) depuis son fork sans bloquer l'équipe. Les difficultés venaient de l'organisation et non du code. Des droits trop limités sur le board, et un suivi des user stories qui dépendait de mises à jour manuelles, ont rendu son avancement difficile à voir. Pour le prochain onboarding, il faut lui donner les droits d'écriture sur le board seulement, désigner qui fait avancer les user stories et tester le parcours avant son arrivée.

---

## 4. Synthèse et actions

### Ce que les deux rapports disent ensemble

| Constat | Stagiaire | Maître de stage |
| --- | :---: | :---: |
| L'installation guidée par la documentation fonctionne | ✅ | ✅ |
| La protection des branches et le flux fork → PR sont fiables | ✅ | ✅ |
| Le stagiaire ne peut pas faire avancer ses tickets seul | ✅ | ✅ |
| L'avancement d'un ticket ou d'une user story n'est pas visible | ✅ | ✅ |
| Le dépôt est difficile à parcourir (trop de fichiers au même endroit) | ✅ | — |
| L'outillage local peut être simplifié (Docker Compose, hooks Git) | ✅ | — |

Les deux rapports convergent : **le code et la documentation d'installation ont tenu, les frictions viennent des droits sur le board et du suivi de l'avancement.**

### Actions retenues

| # | Action | Origine | Zone |
| --- | --- | --- | --- |
| 1 | Donner au stagiaire le rôle Write sur le board, en gardant Read sur le dépôt | Les deux | Transverse |
| 2 | Le tuteur vérifie le statut des user stories de son stagiaire à chaque point d'équipe | Maître de stage | Transverse |
| 3 | Ajouter une vue « User stories du sprint » avec le statut et la progression des sous-tickets | Les deux | Transverse |
| 4 | Tester le parcours complet avec un compte en lecture seule avant chaque arrivée | Maître de stage | Transverse |
| 5 | Aligner [onboarding.md](onboarding.md) sur les droits réels du stagiaire (en partie fait : le passage sur `statut: bloqué` est corrigé en section 5 ; il reste la section « ce que je peux faire seul / ce que je demande au tuteur ») | Maître de stage | Transverse |
| 6 | Lancer front et back d'une seule commande avec Docker Compose | Stagiaire | Transverse |
| 7 | Bloquer localement les messages de commit hors convention (hook `commit-msg` avec Husky et commitlint) | Stagiaire | Transverse |
| 8 | Réorganiser les fichiers des dossiers les plus chargés par fonctionnalité | Stagiaire | Front, back |

Les actions 1 à 5 sont à faire avant le prochain onboarding. Les actions 6 à 8 sont à créer comme tâches dans le backlog et à prioriser en équipe.
