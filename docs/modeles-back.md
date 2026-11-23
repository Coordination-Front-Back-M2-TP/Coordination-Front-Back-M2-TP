# Génération de modèles IA côté serveur

La tâche [#49](https://github.com/Coordination-Front-Back-M2-TP/Coordination-Front-Back-M2-TP/issues/49) implémente le backend de l’US #24 d’après le [contrat proposé dans la PR #181](https://github.com/Coordination-Front-Back-M2-TP/Coordination-Front-Back-M2-TP/pull/181).

## Configuration

| Variable du serveur | Usage |
| --- | --- |
| `OPENAI_API_KEY` | Authentifie la génération et la modération OpenAI |
| `OPENAI_MODEL` | Identifiant du modèle GPT retenu par l’équipe, compatible avec les sorties JSON structurées de l’API Responses |
| `TYPESAFE_API_KEY` | Active Jev comme second choix de modération |

Sans génération configurée, `GET /api/models/quota` annonce une liste de services vide. Le serveur envoie uniquement la consigne en tant que donnée du joueur. Avec Jev, il exige une probabilité d’autorisation d’au moins `0.8`. Ce seuil initial sera à évaluer sur les consignes du jeu. Avec OpenAI, la génération requiert une réponse de modération valide et non signalée. [Documentation Jev](https://docs.typesafe.ai/api/system-one) · [Modération OpenAI](https://developers.openai.com/api/docs/guides/moderation) · [Sorties structurées OpenAI](https://developers.openai.com/api/docs/guides/structured-outputs)

## Quota et concurrence

Les deux routes utilisent la session du compte. La date du quota est calculée côté serveur en UTC. SQLite réserve une génération par compte avant tout appel externe. Les appels réseau se font sans transaction ouverte. La réservation expire après deux minutes si le processus s’arrête. Les appels de modération et de génération expirent respectivement après 10 et 45 secondes.

Une génération réussie débite une unité seulement après validation de la grille et tant que la réservation correspond à la demande. Une grille contient de 1 à 32 lignes et colonnes, et chaque case colorée appartient à la palette. Le serveur omet les cases transparentes et conserve les coordonnées relatives au coin supérieur gauche. Un refus ou une erreur libère la réservation. Si une génération finit après minuit, le débit s’impute au jour de son acceptation et la réponse affiche le quota du nouveau jour.

## Vérifications

`npm test --prefix back` couvre les appels HTTP de P1X3L avec SQLite et des réponses fournisseurs simulées. Il vérifie le choix du service, le refus, les erreurs, les demandes concurrentes, le quota et le passage à minuit UTC.
