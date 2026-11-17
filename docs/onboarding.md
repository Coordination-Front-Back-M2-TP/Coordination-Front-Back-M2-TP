# Parcours d'accueil et retours de stage

Ce document formalise le parcours d'accueil (onboarding) d'un nouveau développeur stagiaire rejoignant l'équipe 3L1K0PT3R sur le projet P1X3L, ainsi que le cadre de préparation du rapport du stagiaire et de l'évaluation par le maître de stage.

---

## 1. Objectifs de l'accueil

Le parcours d'accueil permet au stagiaire d'être opérationnel rapidement et en confiance :

1. Obtenir l'ensemble des accès nécessaires (code, board, communication).
2. Installer et lancer l'application en local (front React et back Node.js).
3. Comprendre les règles du produit, l'architecture et les conventions de l'équipe.
4. Prendre en charge un premier ticket (user story ou tâche technique).
5. Réaliser des commits réguliers, lancer les tests et ouvrir sa première pull request.
6. Préparer les éléments de suivi pour son rapport de stage et son évaluation.

---

## 2. Accès et préparation de l'environnement

Avant le premier jour ou dès l'arrivée, s'assurer d'avoir :

| Élément | Rôle | Action |
| --- | --- | --- |
| Dépôt GitHub | Lire le dépôt privé et proposer une contribution depuis un fork | Accepter l'invitation en lecture au dépôt amont, puis créer un fork dans son compte personnel. Aucun droit d'écriture sur l'amont n'est nécessaire. |
| Board GitHub | Lire tout le board : tickets, statuts, dépendances, vues | Accepter l'accès en lecture (rôle Read) au board. L'accès au dépôt ne donne pas automatiquement accès au board : le tuteur l'ajoute à part. |
| Discord de l'équipe | Communication quotidienne, questions, alertes | Rejoindre le serveur Discord de l'équipe 3L1K0PT3R |
| Outils locaux | Git, Node.js (>= 22.12), GitHub CLI (`gh` >= 2.94) | Vérifier avec `git --version`, `node --version`, `gh --version` |

Le fork privé dépend également des réglages de l'organisation GitHub. Si GitHub refuse sa création, demander au tuteur de vérifier que le fork des dépôts privés est autorisé ; ne pas demander de droit d'écriture sur le dépôt amont pour contourner ce réglage.

### Ce que fait le tuteur à l'arrivée

Le stagiaire est en lecture seule sur le dépôt et sur le board : il lit tout, il ne peut rien modifier, et il contribue par des PR depuis son fork. Le prof lui demande d'essayer de casser le projet s'il en a les droits : ces réglages sont la limite de son périmètre.

1. **Dépôt** : dans le dépôt, Settings, Collaborators and teams, Add people, rôle **Read**. Il devient collaborateur extérieur de ce seul dépôt. Ne pas l'inviter dans l'organisation : un membre hérite du rôle de base des membres sur le board et peut créer des dépôts et des équipes. Ne pas lui donner Triage non plus : ce rôle permet déjà de fermer n'importe quelle issue.
2. **Board**, une fois l'invitation au dépôt acceptée : dans le board, menu `…`, Settings, Manage access, ajouter son compte avec le rôle **Read**. GitHub n'accepte un collaborateur extérieur sur le board que s'il a déjà accès à un dépôt de l'organisation.
3. **Tickets** : lui assigner ses tickets (au Sprint 2 : #43, #44 et #95). En lecture seule, il ne peut pas se les assigner.
4. **Vérifier** : `gh api repos/Coordination-Front-Back-M2-TP/Coordination-Front-Back-M2-TP/collaborators/<compte>/permission --jq .role_name` doit répondre `read`, et Manage access doit afficher le rôle Read pour son compte sur le board.

### Installation locale

Suivre scrupuleusement le guide pas à pas dans [INSTALL.md](../INSTALL.md) :

1. Créer le fork du dépôt amont `Coordination-Front-Back-M2-TP/Coordination-Front-Back-M2-TP` dans son compte GitHub personnel.
2. Cloner son fork dans un chemin sans caractère « & » :

   ```bash
   git clone https://github.com/<compte-github-du-stagiaire>/Coordination-Front-Back-M2-TP.git
   cd Coordination-Front-Back-M2-TP
   git remote add upstream https://github.com/Coordination-Front-Back-M2-TP/Coordination-Front-Back-M2-TP.git
   git fetch upstream
   ```

3. Installer les dépendances du back (`npm ci --prefix back`) et du front (`npm ci --prefix front`).
4. Lancer le back dans un terminal (`npm run dev --prefix back`, écoute sur `http://localhost:3000`).
5. Lancer le front dans un autre terminal (`npm run dev --prefix front`, ouvre `http://localhost:5173`).
6. Vérifier que la page d'accueil affiche « P1X3L » et « Back : ok ».

---

## 3. Comprendre le projet et l'équipe

### Le produit P1X3L

- Lire le [README.md](../README.md) pour la vision globale.
- Lire [docs/besoin.md](besoin.md) : règles du jeu (pixel war en temps réel, équipes de couleur, cooldown entre poses, modération, rôle de l'IA et de l'agent de dessin).
- Parcourir [docs/story-map.md](story-map.md) : découpage des fonctionnalités en activités et tranches de livraison.

### L'équipe et les rôles

L'équipe 3L1K0PT3R est composée de :

- **Lucas** : Product Owner et développeur.
- **Théo** : Coordination, Tech Lead Front et développeur.
- **Swan** : Tech Lead Back et développeur.

Les responsabilités et rituels agiles sont détaillés dans [docs/gestion-de-projet.md](gestion-de-projet.md). Tout le monde développe, et chaque membre est disponible pour aider le stagiaire en cas de doute.

### Les conventions de développement

Lire attentivement [GUIDELINES.md](../GUIDELINES.md) avant d'écrire la moindre ligne de code :

- Séparation claire : `front/src/components/`, `front/src/api/`, `back/src/routes/`, `back/src/services/`.
- Contrat d'API d'abord : toute route ou événement temps réel est formalisé avant son implémentation.
- Format des erreurs standardisé : `{ "error": { "code": "...", "message": "..." } }`.
- Langue : anglais pour le code et les clés JSON, français pour la documentation, les commentaires et les tickets.

---

## 4. Prendre son premier ticket

Le suivi du travail se fait sur le board GitHub Projects : [TP Coordination Front&Back](https://github.com/orgs/Coordination-Front-Back-M2-TP/projects/1).

### Choisir un ticket

Pour le TD « Road to MVP », le plan respecte la consigne d'une story fullstack pour l'équipe et d'une pour le stagiaire :

- `#15` « Voir la toile en direct » est la story de l'équipe ; ses tâches de contrat, front et back sont déjà réparties entre ses membres.
- `#21` « Poser un pixel » est la story proposée au stagiaire. Son compte GitHub n'étant pas encore connu, l'issue ne lui est pas assignée à l'avance.

Le tuteur confirme le ticket et son périmètre à l'arrivée du stagiaire. La story #21 dépend aussi de #18 (« Créer un compte et se connecter »), qui n'est pas planifiée au Sprint 2 : confirmer avec l'équipe comment traiter ce prérequis avant de promettre la livraison complète.

### S'assigner le ticket

En lecture seule, le stagiaire ne peut ni s'assigner une issue ni déplacer une carte du board. Le tuteur lui assigne ses tickets à son arrivée (section 2). Ensuite, le board avance seul : quand il ouvre sa PR avec `Closes #numéro`, le ticket passe en « En revue », puis en « Terminé » au merge. Ses tickets passent donc de « Prêt » à « En revue » sans passer par « En cours ».

---

## 5. Flux de travail au quotidien

Tout le flux de travail est décrit dans [CONTRIBUTING.md](../CONTRIBUTING.md). Voici les règles clés à appliquer :

### Créer une branche

Le stagiaire travaille dans son fork : il ne pousse jamais sur le dépôt amont. Pour partir de la dernière version de `main`, après avoir configuré `origin` sur son fork et `upstream` sur le dépôt de l'équipe :

```bash
git fetch upstream
git switch -c <type>/<numéro>-<description-courte> upstream/main
```

Exemple : `feat/21-poser-un-pixel`. Après les commits, il pousse la branche sur son fork (`origin`) et ouvre une PR vers `main` du dépôt amont. Le détail est dans [CONTRIBUTING.md](../CONTRIBUTING.md).

### Commits réguliers et atomiques

Faire des commits fréquents et ciblés en respectant la norme Conventional Commits :

```text
type(zone): description à l'impératif sans point final
```

Types autorisés : `feat`, `fix`, `docs`, `ci`, `chore`, `refactor`, `test`, `style`, `perf`, `build`, `revert`. Zones autorisées : `front`, `back`, `transverse`.

### Communiquer en cas de question ou de blocage

- Une question technique ou fonctionnelle se pose directement dans le ticket GitHub concerné ou sur le salon Discord de l'équipe.
- Si le ticket ne peut plus avancer (dépendance non livrée, décision en attente) : ajouter immédiatement le label `statut: bloqué` sur l'issue et expliquer le blocage en commentaire.

---

## 6. Vérifications locales et Pull Request

### Lancer les vérifications

Avant de pousser ou d'ouvrir une PR, exécuter impérativement les contrôles de la CI en local :

| Contrôle | Commande |
| --- | --- |
| Tests du back | `npm test --prefix back` |
| Lint du front | `npm run lint --prefix front` |
| Build du front | `npm run build --prefix front` |
| Lint Markdown | `npx --yes markdownlint-cli2@0.23.3 "**/*.md" "!**/node_modules" "!.github/pull_request_template.md"` |

Tous ces contrôles doivent être au vert.

### Ouvrir la Pull Request

1. Pousser la branche : `git push -u origin <nom-de-branche>`.
2. Ouvrir la PR sur GitHub en direction de `main`.
3. Remplir intégralement le gabarit `.github/pull_request_template.md` :
   - Indiquer la ligne de fermeture : `Closes #<numéro>`.
   - Cocher un seul type de changement (celui qui correspond au type du titre).
   - Cocher l'ensemble des critères de la Définition de « fini » (Definition of Done).
   - Décrire les points clés dans les notes pour la relecture.

### Relecture et merge

- Ne jamais merger sa propre PR.
- Assigner un relecteur : Théo pour le front, Swan pour le back, ou Lucas.
- Prendre en compte les remarques, corriger sur la branche et repousser.
- Une fois la PR approuvée et la CI verte, le relecteur réalise le squash and merge.
- Une PR de fork est relue avec la checklist « Relire une PR de fork » de [CONTRIBUTING.md](../CONTRIBUTING.md), section 9.

---

## 7. Retours et évaluation de stage

Pour valoriser le travail réalisé et préparer la fin de stage, deux documents sont à formaliser.

### Rapport d'activité du stagiaire

Le stagiaire documente son parcours tout au long du stage afin de préparer son rapport final :

- **Contexte et intégration** : présentation du projet P1X3L, prise en main de la pile technique (React, Express, Socket.IO) et rôle au sein de l'équipe.
- **Réalisations techniques** : liste commentée des user stories et tâches réalisées, avec liens vers les issues et les PRs associées.
- **Coordination front/back** : exemples concrets de collaboration autour du contrat d'API et des événements temps réel.
- **Compétences acquises** : pratique de Git (trunk-based, PRs, conventional commits), mise en œuvre des tests, CI/CD, revues de code.
- **Difficultés et solutions** : problèmes techniques rencontrés, démarche de diagnostic et résolutions trouvées.

Cette trame aide à garder une trace des activités pendant le stage. Le plan et les critères de notation officiels seront intégrés dès que le professeur les aura communiqués ; cette proposition ne les remplace pas.

### Évaluation par le maître de stage

Le maître de stage (ou tuteur au sein de l'équipe 3L1K0PT3R) prépare l'évaluation selon les axes suivants :

- **Assiduité et communication** : ponctualité, participation aux rituels d'équipe (planification, rétrospectives), réactivité sur Discord.
- **Qualité technique et rigueur** : respect des conventions de code ([GUIDELINES.md](../GUIDELINES.md)), écriture des tests, clarté des commits et des descriptions de PR.
- **Autonomie et proactivité** : capacité à chercher l'information, à lever des alertes rapidement et à proposer des améliorations.
- **Respect des délais et des engagements** : progression sur les tickets pris en charge par rapport aux estimations.

Ces axes constituent une base de suivi interne, pas la grille officielle de notation. Les critères définitifs et les modalités de transmission seront alignés sur les consignes du professeur lorsqu'elles auront été communiquées.
