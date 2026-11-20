# Définition du besoin

Ce document décrit ce que le produit doit faire et pourquoi. Il a été validé par Lucas le 9 octobre 2026. Les personas (`docs/personas.md`, à venir) préciseront qui sont les joueurs. Le découpage en tickets est sur le [board](https://github.com/orgs/Coordination-Front-Back-M2-TP/projects/1).

## 1. Vision

Une toile partagée où des équipes s'affrontent pixel par pixel, aidées par des agents qui dessinent pour elles à partir de modèles proposés par une IA.

## 2. Boucle de jeu

1. Je crée un compte, puis je rejoins une équipe ou j'en crée une.
2. Je pose un pixel de la couleur de mon choix, puis j'attends la fin du délai. Le délai est compté par le serveur, pas par le navigateur.
3. Je demande un modèle à l'IA, par exemple « un dragon rouge ». Jev vérifie la consigne, GPT dessine le modèle, qui s'affiche en transparence sur la toile.
4. Je pose le modèle moi-même, pixel par pixel, ou je le confie à mon agent de dessin, qui pose un pixel à chaque fin de délai en mon nom.
5. Un classement des équipes et un timelapse (la toile rejouée en accéléré) montrent qui domine la toile.

## 3. Règles du jeu

| Règle | Valeur | Statut |
| --- | --- | --- |
| Délai entre deux pixels | 10 secondes pour la démo, réglable | Proposé |
| Palette | 16 couleurs fixes, ouvertes à tous les joueurs : l'équipe ne limite pas la couleur posée | Décidé |
| Taille de la toile | Fixe, à choisir | À décider |
| Taille d'un modèle IA | 32 × 32 pixels au plus | Proposé |
| Quota de modèles IA | 5 par compte et par jour | Décidé |
| Équipes | Pas de limite de nombre : un joueur peut créer une équipe. Chaque équipe a une couleur pour la reconnaître (podium, pseudo) | Décidé |
| Changement d'équipe | Au plus toutes les 5 minutes, réglable | Décidé |
| Spectateurs | La toile se regarde sans compte. Poser un pixel demande un compte | Décidé |
| Modèle actif | Un seul modèle actif par compte | Décidé |
| Agent hors connexion | L'agent de dessin continue quand le joueur est déconnecté | Décidé |

Les décisions datent du 9 octobre 2026, sauf la palette et les équipes, revues le 20 novembre 2026 : la première version limitait le jeu à 4 équipes, et « équipe de couleur » pouvait se lire comme « on ne pose que la couleur de son équipe ». Ce n'est pas la règle.

**Un compte, un délai.** Pendant que l'agent de dessin travaille, il utilise le délai du compte : le joueur ne pose pas de pixel en plus à la main. L'IA aide à dessiner, elle ne donne pas plus de pixels.

## 4. Rôle de l'IA

| Acteur | Ce qu'il fait | Appels à une IA |
| --- | --- | --- |
| Jev | Vérifie la consigne du joueur et refuse ce qui est choquant | 1 par modèle |
| GPT | Transforme la consigne en grille de pixels (JSON aux couleurs de la palette) | 1 par modèle |
| Agent de dessin | Programme du serveur, sans IA. À chaque fin de délai, compare le modèle et la toile, pose le prochain pixel qui ne correspond pas, et répare les pixels écrasés par une autre équipe | Aucun |

Un dessin coûte donc deux appels courts, quel que soit son nombre de pixels.

Parcours d'une demande de modèle :

1. Le front envoie la consigne.
2. Le back vérifie le quota du compte.
3. Jev vérifie la consigne. Si elle est refusée, le joueur voit pourquoi, et le quota n'est pas consommé.
4. GPT renvoie la grille. Le back la valide (taille, couleurs de la palette) avant de la renvoyer au front.
5. Le front affiche le modèle en transparence. Le joueur le place sur la toile, puis le pose lui-même ou lance son agent.

En option : un modèle créé à partir d'une image générée, puis réduite en pixels aux couleurs de la palette. Plus joli, mais plus lent et plus cher.

## 5. Périmètre : les EPICs

Les EPICs sortent de la [story map](story-map.md) : ce sont les 6 activités du parcours des joueurs et de la modératrice. Les EPICs 1 à 5 forment la démo du TP, le 6 vient après. Chacun a des tâches front et des tâches back. Sa première user story contient une tâche transverse « contrat » : écrire les routes et les messages temps réel avant de coder, pour que le front et le back avancent en parallèle.

| EPIC | User stories | Front | Back |
| --- | --- | --- | --- |
| 1. Découvrir la toile | Voir la toile en direct. Naviguer sur la toile. | Affichage de la toile en direct, zoom, déplacement | Toile en base SQLite, envoi au chargement, diffusion Socket.IO |
| 2. Rejoindre le jeu | Créer un compte et se connecter. Rejoindre une équipe. | Inscription, connexion, choix de l'équipe | Mot de passe haché, session, API des équipes, changement limité |
| 3. Dessiner à la main | Poser un pixel. Voir mon délai. | Palette, pose, compte à rebours | Vérification de la pose, délai compté par le serveur, historique |
| 4. Dessiner avec l'IA | Demander un modèle. Le confier à mon agent. En option : modèle depuis une image. | Saisie de la consigne, aperçu en transparence, bouton de l'agent et progression | Quota, Jev puis GPT, validation de la grille, agent de dessin, pixellisation en option |
| 5. Suivre la bataille | Voir le classement des équipes. Revoir la toile en accéléré. | Podium en direct, lecteur du timelapse | Pixels de chaque équipe, API de l'historique des poses |
| 6. Modérer la toile | Nettoyer une zone. Bannir un joueur et annuler ses pixels. | Écran admin : zone à nettoyer, liste des joueurs | Rôle admin, nettoyage de zone, bannissement, annulation des poses, journal des actions |

## 6. Hors périmètre de la première version

- Chat entre joueurs.
- Application mobile native. Le site reste jouable sur le navigateur d'un smartphone.
- Paiement.

Jusqu'à l'EPIC 6, un joueur peut dessiner à la main quelque chose de choquant, comme dans toute pixel war : Jev ne filtre que les consignes données à l'IA.

## 7. Critères de réussite pour la démo

- Au moins 3 navigateurs jouent en même temps, et un pixel posé apparaît chez tout le monde en moins d'une seconde.
- Un agent de dessin termine un modèle de bout en bout, puis répare un pixel écrasé.
- Jev refuse une consigne choquante, et le quota n'est pas consommé.
- Le classement suit la toile en direct.

## 8. Contraintes

- Stack : React (Vite) pour le front, Node.js (Express, Socket.IO) pour le back, SQLite avec Prisma pour les données. Les versions et les conventions iront dans [INSTALL.md](../INSTALL.md) et [GUIDELINES.md](../GUIDELINES.md) au démarrage du code.
- Les clés d'API de GPT et de Jev restent côté serveur, dans des variables d'environnement. Jamais dans le dépôt ni dans le front.
- Seule la consigne part vers GPT et Jev : ni pseudo, ni mot de passe, ni autre donnée du compte.
- Le contrat entre le front et le back (routes, messages temps réel, format des erreurs) est écrit avant le code, par les tâches « contrat ».

## 9. Questions ouvertes

- Taille de la toile et délai définitif.
- Modèle GPT utilisé et son coût par appel.
- Comment appeler Jev : adresse, format de la réponse, temps de réponse.
- Ce que les personas changent aux user stories.
