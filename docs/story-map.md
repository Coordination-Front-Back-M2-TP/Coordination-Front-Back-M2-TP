# Story map

La story map range les user stories selon le parcours du joueur. De gauche à droite : les activités du joueur, dans l'ordre où il les vit. Chaque activité est un EPIC. De haut en bas : les tranches de livraison, de la plus prioritaire à la moins prioritaire. Le besoin complet est dans [besoin.md](besoin.md).

## Carte

| | 1. Découvrir la toile | 2. Rejoindre le jeu | 3. Dessiner à la main | 4. Dessiner avec l'IA | 5. Suivre la bataille |
| --- | --- | --- | --- | --- | --- |
| **Étapes du joueur** | Ouvrir la page, regarder la toile bouger, se déplacer dessus | Créer un compte, se connecter, choisir une équipe | Choisir une couleur, poser un pixel, attendre le délai | Décrire un dessin, placer le modèle, lancer l'agent | Voir qui gagne, revoir la partie |
| **Tranche 1 : démo du TP** | Voir la toile en direct | Créer un compte et se connecter<br>Rejoindre une équipe | Poser un pixel<br>Voir mon délai | Demander un modèle à l'IA<br>Confier le modèle à mon agent | Voir le classement des équipes |
| **Tranche 2 : après la démo** | Naviguer sur la toile (zoom, déplacement) | | | | Revoir la toile en accéléré |
| **Option** | | | | Modèle depuis une image | |

Hors de la carte pour l'instant : chat, application mobile, modération par un admin, paiement.

## EPICs et user stories

Estimations en points et priorités de départ, à revoir en équipe.

| EPIC | User story | Points | Priorité | Tranche |
| --- | --- | --- | --- | --- |
| 1. Découvrir la toile | Voir la toile en direct | 3 | Haute | 1 |
| 1. Découvrir la toile | Naviguer sur la toile | 2 | Moyenne | 2 |
| 2. Rejoindre le jeu | Créer un compte et se connecter | 5 | Haute | 1 |
| 2. Rejoindre le jeu | Rejoindre une équipe | 3 | Haute | 1 |
| 3. Dessiner à la main | Poser un pixel | 3 | Haute | 1 |
| 3. Dessiner à la main | Voir mon délai | 2 | Haute | 1 |
| 4. Dessiner avec l'IA | Demander un modèle à l'IA | 8 | Moyenne | 1 |
| 4. Dessiner avec l'IA | Confier le modèle à mon agent | 5 | Moyenne | 1 |
| 4. Dessiner avec l'IA | Modèle depuis une image | 5 | Basse | Option |
| 5. Suivre la bataille | Voir le classement des équipes | 3 | Moyenne | 1 |
| 5. Suivre la bataille | Revoir la toile en accéléré | 5 | Basse | 2 |

Tranche 1 : 32 points. Total : 44 points.

## Tâches front et back

Chaque EPIC commence par une tâche transverse « contrat », rangée sous sa première user story : écrire les routes et les messages temps réel avant de coder, pour que le front et le back avancent en parallèle.

| User story | Front | Back |
| --- | --- | --- |
| Voir la toile en direct | Afficher la toile et ses mises à jour en direct | Stocker la toile, l'envoyer au chargement, diffuser chaque pixel posé |
| Naviguer sur la toile | Zoom et déplacement | Aucune tâche |
| Créer un compte et se connecter | Pages d'inscription et de connexion, état connecté | Inscription, connexion, déconnexion, mot de passe haché, session |
| Rejoindre une équipe | Choix de l'équipe, équipe affichée près du pseudo | API des équipes, changement au plus toutes les 5 minutes |
| Poser un pixel | Palette et clic de pose | Vérifier les coordonnées et la couleur, enregistrer la pose |
| Voir mon délai | Compte à rebours | Délai vérifié par le serveur, temps restant renvoyé |
| Demander un modèle à l'IA | Saisie de la consigne, aperçu en transparence, placement | Quota, appel à Jev puis à GPT, contrôle de la grille |
| Confier le modèle à mon agent | Lancer et arrêter l'agent, progression | Agent de dessin sans IA, qui répare les pixels écrasés |
| Modèle depuis une image | Choix du mode image | Génération de l'image, réduction en pixels |
| Voir le classement des équipes | Podium en direct | Calcul et diffusion du classement |
| Revoir la toile en accéléré | Lecteur du timelapse | API de l'historique des poses par période |
