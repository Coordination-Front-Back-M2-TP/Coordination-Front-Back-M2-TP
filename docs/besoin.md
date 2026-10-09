# Définition du besoin

Ce document décrit ce que le produit doit faire et pourquoi. Il a été validé par Lucas le 9 octobre 2026. Les personas (`docs/personas.md`, à venir) préciseront qui sont les joueurs. Le découpage en tickets est sur le [board](https://github.com/orgs/Coordination-Front-Back-M2-TP/projects/1).

## 1. Vision

Une toile partagée où des équipes s'affrontent pixel par pixel, aidées par des agents qui dessinent pour elles à partir de modèles proposés par une IA.

## 2. Boucle de jeu

1. Je crée un compte, puis je rejoins une équipe de couleur.
2. Je pose un pixel, puis j'attends la fin du délai. Le délai est compté par le serveur, pas par le navigateur.
3. Je demande un modèle à l'IA, par exemple « un dragon rouge ». Jev vérifie la consigne, GPT dessine le modèle, qui s'affiche en transparence sur la toile.
4. Je pose le modèle moi-même, pixel par pixel, ou je le confie à mon agent de dessin, qui pose un pixel à chaque fin de délai en mon nom.
5. Un classement des équipes et un timelapse (la toile rejouée en accéléré) montrent qui domine la toile.

## 3. Règles du jeu

| Règle | Valeur | Statut |
| --- | --- | --- |
| Délai entre deux pixels | 10 secondes pour la démo, réglable | Proposé |
| Palette | Environ 16 couleurs fixes | Proposé |
| Taille de la toile | Fixe, à choisir | À décider |
| Taille d'un modèle IA | 32 × 32 pixels au plus | Proposé |
| Quota de modèles IA | Un nombre de modèles par compte et par jour | Nombre à décider |

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

Chaque EPIC a des tâches front et des tâches back. Sa première user story contient une tâche transverse « contrat » : écrire les routes et les messages temps réel avant de coder, pour que le front et le back avancent en parallèle.

| EPIC | User stories | Front | Back |
| --- | --- | --- | --- |
| 1. Toile en temps réel | Voir la toile en direct. Poser un pixel. | Affichage de la toile (zoom, déplacement), palette, compte à rebours | Grille en base SQLite, diffusion Socket.IO, délai vérifié par le serveur |
| 2. Comptes et équipes | Créer un compte et se connecter. Rejoindre une équipe. | Inscription, connexion, choix de l'équipe | Mot de passe haché, session, API des équipes, pixels rattachés à l'équipe |
| 3. Modèles IA et agent de dessin | Demander un modèle. Le confier à mon agent. En option : modèle depuis une image. | Saisie de la consigne, aperçu en transparence, bouton de l'agent et progression | Jev puis GPT, validation de la grille, quota, agent de dessin, pixellisation en option |
| 4. Classement et timelapse | Voir le classement des équipes. Revoir la toile en accéléré. | Podium en direct, lecteur du timelapse | Pixels de chaque équipe, API de l'historique des poses |

## 6. Hors périmètre de la première version

- Chat entre joueurs.
- Application mobile.
- Modération à la main par un admin. Un joueur peut toujours dessiner à la main quelque chose de choquant, comme dans toute pixel war.
- Paiement.

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

- Taille de la toile, délai définitif et quota de modèles IA.
- Modèle GPT utilisé et son coût par appel.
- Comment appeler Jev : adresse, format de la réponse, temps de réponse.
- Ce que les personas changent aux user stories.
