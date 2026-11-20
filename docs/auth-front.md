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

## Créer une équipe

Une fois connecté, le joueur peut créer une équipe depuis l’accueil en choisissant un nom et l’une des 16 couleurs. Le formulaire envoie `POST /api/teams`. Après confirmation, l’équipe s’affiche près du pseudo et le formulaire indique le temps restant avant le prochain changement d’équipe.

Si le serveur refuse une création pendant le délai, le formulaire utilise l’en-tête `Retry-After` pour indiquer quand réessayer. Les autres erreurs laissent le nom et la couleur saisis disponibles pour correction. Les règles et les réponses de la route figurent dans le [contrat de création d’équipe](contrat-api.md#créer-une-équipe).
