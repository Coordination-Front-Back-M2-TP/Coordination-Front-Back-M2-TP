# Inscription, connexion et état connecté (front)

Tâche [#38](https://github.com/Coordination-Front-Back-M2-TP/Coordination-Front-Back-M2-TP/issues/38), user story #18.

Depuis l'accueil, « Créer un compte » ouvre le formulaire d'inscription sur place. Après l'inscription ou la connexion, l'accueil affiche le pseudo et le bouton « Se déconnecter ». La toile reste consultable pendant tout le parcours.

Le navigateur conserve le cookie de session posé par le serveur. Après un rechargement, le front retrouve le joueur via l'API de compte. La déconnexion efface la session côté serveur et réaffiche le formulaire.

| Action | Route | Succès | Erreurs gérées |
| --- | --- | --- | --- |
| Retrouver la session | GET /api/auth/me | 200 avec le joueur | 401 pour un visiteur |
| S'inscrire | POST /api/auth/register | 201 avec le joueur | PSEUDO_TAKEN, INVALID_INPUT |
| Se connecter | POST /api/auth/login | 200 avec le joueur | INVALID_CREDENTIALS, INVALID_INPUT |
| Se déconnecter | POST /api/auth/logout | 204 | |

Les champs attendus et le format du joueur sont décrits dans [Comptes et session (back)](comptes-back.md).

## Rejoindre une équipe

Après la connexion, le menu « Équipe à rejoindre » liste les équipes disponibles. L'équipe actuelle reste visible dans la liste, mais ne peut pas être choisie à nouveau. Le premier choix est immédiat. Le nom de l'équipe rejointe apparaît à côté du pseudo et la pose devient disponible sans recharger la page. La toile reste consultable avant le choix.

Le front charge les équipes via `GET /api/teams` et enregistre le choix via `PUT /api/auth/me/team`. Le bouton « Actualiser les équipes » recharge la liste lorsqu'une équipe a été créée pendant que la page était ouverte. Si le serveur refuse un changement d'équipe en raison du délai, le formulaire indique le temps restant donné par `Retry-After`.

## Créer une équipe

Un joueur connecté peut aussi utiliser « Créer une équipe » à côté du choix d'équipe. Il saisit un nom de 3 à 20 caractères et choisit une couleur de la palette. Après confirmation, l'équipe créée devient la sienne sans rechargement et la liste des équipes est actualisée. La même couleur peut servir à plusieurs équipes.

Le front envoie `POST /api/teams` et affiche les erreurs de validation, de nom déjà pris, de session et de bannissement. Une création compte comme un changement d'équipe : si le serveur renvoie `429 TEAM_CHANGE_COOLDOWN`, le formulaire affiche le temps restant indiqué par `Retry-After`. En cas d’erreur, le nom et la couleur restent saisis. Le délai est commun aux formulaires de création et de changement d’équipe. Les règles complètes figurent dans [le contrat](contrat-api.md#créer-une-équipe).
