# Affichage de la toile en direct

L’issue [#34](https://github.com/Coordination-Front-Back-M2-TP/Coordination-Front-Back-M2-TP/issues/34) implémente la lecture publique de la toile selon le [contrat de l’EPIC Découvrir la toile](contrat-api.md). Elle affiche l’état existant et les changements reçus, sans demander de compte.

## Affichage

`LiveCanvas` est monté sur la page d’accueil. Il annonce le chargement, le fonctionnement en direct, une reconnexion ou une indisponibilité. Un bouton « Réessayer » ouvre un nouvel abonnement après une erreur.

`PixelCanvas` dessine les pixels dans un élément `canvas`, sans lissage à l’agrandissement. Les cases absentes de l’instantané restent transparentes sur un damier. Les coordonnées et les couleurs sont également consultables dans une liste textuelle dépliable au clavier.

Les dimensions viennent de l’instantané serveur : le front ne fixe pas la proposition `101 × 101`. L’origine est au centre, `x` augmente vers la droite et `y` vers le bas. Pour dessiner un pixel, le front traduit ses coordonnées par `floor(width / 2)` et `floor(height / 2)`. Les couleurs proviennent du serveur au format `#RRGGBB` ; le front ne choisit pas une palette à la place de l’équipe.

## Chargement et cohérence

Les échanges passent par `front/src/api/canvas.js`, dans le namespace Socket.IO `/` :

1. Les écouteurs sont installés avant l’ouverture de la connexion.
2. À chaque connexion, le client émet `canvas:subscribe`, sans payload ni authentification.
3. Les événements `pixel:updated` reçus avant l’ACK restent en attente.
4. L’instantané de l’ACK remplace la toile locale. Les événements en attente sont appliqués dans l’ordre des révisions, en ignorant ceux déjà inclus dans l’instantané.
5. Chaque changement ultérieur remplace seulement une version plus ancienne du même pixel. Une révision reçue sur une autre coordonnée reste applicable même si un événement plus récent est arrivé auparavant.

Le client temps réel charge son état initial avec l’ACK de `canvas:subscribe`, comme le prévoit le contrat. La route HTTP `GET /api/pixels` reste disponible pour les autres usages prévus par ce contrat.

Une déconnexion invalide les événements en attente et les anciens ACK. Le dernier état reste visible avec un avertissement explicite indiquant qu’il peut être ancien. Après reconnexion, un nouvel instantané complet remplace cet état. Le démontage retire les écouteurs, émet `canvas:unsubscribe` si la connexion est encore ouverte, puis ferme le socket.

Un ACK absent pendant dix secondes, des données incompatibles ou `canvas:error` donnent un état d’échec compréhensible. Le message affiché est fixe : les messages et diagnostics techniques du serveur ne sont pas insérés dans l’interface.

## Réseau et installation

Socket.IO client est une dépendance du front, fixée dans `package-lock.json`. Le navigateur contacte `/socket.io/` sur la même origine que la page ; Vite en développement et Nginx dans l’image du front transmettent cette route au back, avec prise en charge du passage à WebSocket. Aucune nouvelle variable d’environnement n’est nécessaire.

Le back fournit le contrat de lecture et de souscription dans [#35](https://github.com/Coordination-Front-Back-M2-TP/Coordination-Front-Back-M2-TP/issues/35). Il persiste l’état courant dans SQLite et renvoie un instantané public ; la méthode interne qui diffuse une pose après persistance sera appelée par le futur parcours de pose de l’issue #21.

## Vérifications

`npm test --prefix front` couvre :

- la validation des instantanés, les coordonnées centrées et les révisions ;
- les événements précédant l’ACK, les doublons, les réponses tardives et la reconnexion ;
- les états de l’interface, le dessin et l’alternative textuelle ;
- l’accès sans authentification, la réception d’un pixel en moins d’une seconde et une coupure de transport avec un vrai serveur Socket.IO de test.

Le serveur Socket.IO installé en dépendance de développement sert uniquement aux tests d’intégration. Il simule le contrat validé et n’implémente pas la persistance du back.

Après livraison de #35, vérifier le parcours intégré avec deux navigateurs : tous deux chargent les pixels existants sans compte, reçoivent un changement serveur sans recharger, puis retrouvent le nouvel état complet après une coupure et une reconnexion. La validation de la latence en conditions réelles fait partie de cette vérification intégrée.

## Naviguer sur la toile

Utilisez la molette, le pincement à deux doigts ou les boutons au-dessus de la toile pour zoomer. Une fois la toile agrandie, faites-la glisser à la souris ou au doigt. Au clavier, placez le focus sur la toile et déplacez la vue avec les flèches. Le bouton « Vue d’ensemble » rétablit l’affichage initial. Un clic ou un tap sur une case conserve le comportement de pose habituel pour un joueur qui peut poser.
