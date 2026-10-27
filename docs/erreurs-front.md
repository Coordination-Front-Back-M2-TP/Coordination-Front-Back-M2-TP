# Erreurs visibles côté front

La page de départ vérifie la connexion avec `GET /api/health`, dont le contrat est décrit dans [la documentation de l’API](api.md) et `back/src/openapi.json`.

## Connexion au serveur

| Cas | État affiché |
| --- | --- |
| Requête en cours | « Back : vérification… » |
| Réponse HTTP réussie, JSON avec `status: "ok"` | « Back : ok » |
| Erreur HTTP ou réseau, JSON illisible ou état absent/invalide | « Back : injoignable » et un message invitant à recharger la page |

Les appels passent par `front/src/api/health.js`. Le message affiché en cas d’échec est fixe : le statut HTTP textuel, le contenu de la réponse et les messages d’exception ne sont jamais insérés dans l’interface. Le message est annoncé par une région `alert` ; l’état de connexion conserve la région `status` du composant `ServerStatus`.

Une requête est annulée au démontage du composant. Ses résultats tardifs sont ignorés, y compris lorsque React relance l’effet en `StrictMode`, afin qu’une ancienne réponse ne remplace pas l’état courant.

## Erreur d’exécution React

`ErrorBoundary`, placé autour de l’application dans `front/src/main.jsx`, remplace le contenu par « Une erreur est survenue. Rechargez la page pour réessayer. » lorsqu’un rendu ou un effet React échoue. Le message de l’exception et sa stack ne sont pas affichés dans cet état de repli.

Une frontière d’erreur React couvre le rendu et les effets de son arbre. Les rejets de requêtes sont traités dans l’effet qui les lance ; les futurs gestionnaires d’événements et traitements asynchrones devront aussi prendre en charge leurs erreurs.

Le contrat global d’erreurs (codes métier, choix HTTP des futures routes et journalisation du back) reste suivi dans [la tâche #88](https://github.com/Coordination-Front-Back-M2-TP/Coordination-Front-Back-M2-TP/issues/88), à valider avec l’équipe front et back.

## Vérification

`npm test --prefix front` lance les tests Vitest avec Testing Library et jsdom : connexion, erreurs HTTP/réseau, réponses invalides, annulation et réponses tardives, erreurs de rendu et d’effet React. Les erreurs simulées contiennent un détail interne factice pour vérifier son absence dans l’interface.
