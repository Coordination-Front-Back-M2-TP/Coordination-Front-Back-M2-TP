# Classement des équipes en direct

La tâche [#55](https://github.com/Coordination-Front-Back-M2-TP/Coordination-Front-Back-M2-TP/issues/55) affiche le classement public sur la page de la toile, suivant le [contrat](contrat-api.md#get-apirankings--classement-des-équipes). Chaque ligne donne le rang, le nom, la couleur et le nombre de pixels visibles de l'équipe. Les égalités et leur ordre sont ceux du serveur ; une équipe sans pixel n'apparaît pas. Un message explique un classement vide.

Le front utilise l'abonnement Socket.IO existant de la toile, puis lit `GET /api/rankings` et `GET /api/teams`. Les événements `ranking:updated` remplacent le classement seulement si leur révision est supérieure à celle déjà reçue : une réponse HTTP tardive ne peut pas effacer un événement plus récent. Le classement est relu après reconnexion. Lorsqu'un identifiant d'équipe est inconnu, la liste des équipes est relue ; si l'identifiant reste introuvable, il est affiché en attendant son nom.

Pendant une coupure ou une erreur, le dernier classement reste visible avec un avertissement. Le bouton de reprise relance les lectures ou l'abonnement de la toile selon la cause. Les requêtes en cours sont annulées au démontage ou à la déconnexion et leurs réponses tardives sont ignorées.

Le calcul des pixels appartient au back : un pixel est attribué à l'équipe de sa dernière pose. Les limitations du serveur, notamment la diffusion après nettoyage ou bannissement et l'authentification encore non raccordée, sont décrites dans [classement-back.md](classement-back.md), [moderation-back.md](moderation-back.md) et [bannissement-back.md](bannissement-back.md).

`npm test --prefix front` vérifie les états du classement, les égalités, les événements, les révisions, les équipes inconnues, les erreurs et la reconnexion.
