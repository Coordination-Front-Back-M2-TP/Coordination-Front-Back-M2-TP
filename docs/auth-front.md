# Inscription, connexion et état connecté (front)

Tâche [#38](https://github.com/Coordination-Front-Back-M2-TP/Coordination-Front-Back-M2-TP/issues/38), user story #18.

> **Routes supposées.** Le contrat de l'EPIC #17 (tâche #37) n'est pas encore mergé. Les chemins ci-dessous sont une hypothèse, isolée dans `front/src/api/auth.js` : à aligner sur le contrat une fois validé.

| Action | Appel supposé | Succès | Erreurs gérées |
| --- | --- | --- | --- |
| Retrouver la session | `GET /api/auth/me` | `200 { user: { pseudo } }` | `401` = visiteur |
| S'inscrire | `POST /api/auth/register` `{ pseudo, password }` | `{ user: { pseudo } }` | `PSEUDO_TAKEN`, `VALIDATION_ERROR` |
| Se connecter | `POST /api/auth/login` `{ pseudo, password }` | `{ user: { pseudo } }` | `INVALID_CREDENTIALS` |
| Se déconnecter | `POST /api/auth/logout` | `204` | |

- La session est un cookie géré par le serveur : le front ne stocke aucun jeton, et un rechargement de page retrouve le joueur via `GET /api/auth/me`.
- `AuthForm` : un seul écran, deux champs (pseudo, mot de passe), bascule inscription / connexion. Les messages d'erreur sont fixes ; le texte du serveur n'est jamais affiché.
- `AccountBar` : pseudo du joueur connecté et déconnexion.
- La toile reste publique : le formulaire ne la masque pas.
