# Personas produit — P1X3L

Ce document rassemble les personas personnalisés pour P1X3L et les deux personas imposés par le cours 2. Les personas personnalisés décrivent des utilisateurs de la pixel war. Les personas imposés sont conservés tels qu’ils ont été transmis ; leurs besoins sont confrontés au périmètre du jeu sans ajouter automatiquement des fonctionnalités.

## Personas personnalisés pour P1X3L

### Alex — L’artiste et le stratège de communauté

> « Je veux qu’on synchronise 50 personnes pour poser notre logo en entier sans qu’un troll détruise nos pixels. »

| Dimension | Détails |
| --- | --- |
| **Identité** | Alex, 22 ans, étudiant en informatique, streamer et modérateur d’un serveur Discord. |
| **Profil et usage** | Joueur très actif. Il organise des raids de placement de pixels avec sa communauté. |
| **Objectifs** | Reproduire une œuvre complexe avec son groupe ; défendre la zone acquise contre les attaques adverses. |
| **Frustrations** | Absence d’outils pour superposer un modèle ; temps de recharge mal indiqué ; attaques de bots automatisés non modérées. |
| **Besoins pour P1X3L** | Toile mise à jour en direct, modèle en transparence, affichage précis du délai et outils de modération. |

### Sam — Le joueur occasionnel

> « J’ai deux minutes à perdre entre deux cours, je pose un pixel pour voir ce qui se passe. »

| Dimension | Détails |
| --- | --- |
| **Identité** | Sam, 19 ans, utilise principalement son smartphone. |
| **Profil et usage** | Il se connecte spontanément, pose quelques pixels ou participe à une zone de couleur unie. |
| **Objectifs** | S’amuser immédiatement sans configuration complexe ; voir l’impact de son pixel sur la carte globale. |
| **Frustrations** | Inscription trop longue ; navigation mobile difficile sur la toile. |
| **Besoins pour P1X3L** | Parcours d’entrée simple, palette accessible et zoom/déplacement fluides sur mobile. |

### Léa — La modératrice

> « Je dois m’assurer que la carte reste propre, sans contenu haineux ni bots automatisés. »

| Dimension | Détails |
| --- | --- |
| **Identité** | Léa, 25 ans, développeuse web et membre de l’équipe d’organisation. |
| **Profil et usage** | Elle surveille la toile, consulte l’historique des pixels et intervient en cas de comportement suspect. |
| **Objectifs** | Maintenir un environnement sain ; identifier et bannir rapidement les scripts ou bots de spam. |
| **Frustrations** | Absence d’outils pour annuler les actions d’un utilisateur ; manque de logs clairs sur l’origine des pixels. |
| **Besoins pour P1X3L** | Rôles utilisateur et administrateur, historique des poses et outils de modération. |

## Personas imposés par le cours 2

Ces profils sont distincts des personas personnalisés ci-dessus. En particulier, le persona imposé nommé Alex n’est pas le persona P1X3L « Alex — L’artiste et le stratège de communauté ».

### Alex — Persona imposé : spécialiste informatique

| Dimension | Détails |
| --- | --- |
| **Identité** | Alex, 27 ans, spécialiste informatique. |
| **Localisation** | New York. |
| **Aisance avec la technologie** | Élevée. |
| **Plateformes utilisées** | Ordinateur et mobile. |
| **Besoin exprimé** | Conserver ses fichiers et projets importants dans un endroit sécurisé ; utiliser un site avec des réussites et de la gamification. |
| **Correspondance avec P1X3L** | Le classement des équipes (#28) répond au besoin de comparer leur progression. Une story de badges (#108) est proposée pour couvrir les réussites individuelles ; elle reste à affiner et n'est pas planifiée. |
| **Limites et arbitrages** | Le besoin de stockage sécurisé n’est pas couvert par le périmètre actuel. Les options examinées et la recommandation sont détaillées ci-dessous ; elles ne constituent pas une décision antérieure de l’équipe. |

#### Options de stockage pour le persona Alex

Le stockage sécurisé est **techniquement réalisable**. Le projet prévoit déjà des comptes (#18), mais cela ne suffit pas à en faire un espace sûr pour des fichiers : il faudrait définir ce qui peut être stocké, qui peut y accéder, combien de temps les données sont gardées, comment elles sont supprimées, et prévoir les coûts et protections adaptés. Ce n’est donc pas une impossibilité technique ; c’est une extension de produit qui n’est pas spécifiée.

Pour la version actuelle, la recommandation est de **ne pas ajouter de stockage général de fichiers personnels** : la vision validée de P1X3L est une pixel war, pas un service de stockage. Les options examinées pour clarifier ce choix sont :

| Option | Évaluation pour P1X3L |
| --- | --- |
| Stocker des fichiers et projets personnels de tout type | Non retenu pour la version actuelle : cela élargirait fortement le produit et demanderait un cadrage distinct des accès, de la conservation, de la suppression, des protections et des coûts. |
| Sauvegarder les créations propres au jeu, par exemple des modèles en pixel art | Piste future plus cohérente avec P1X3L, mais non incluse dans les stories actuelles. À réexaminer si l’équipe veut permettre aux joueurs de retrouver leurs créations. |
| Envoyer les fichiers vers un service de stockage tiers | Non retenu : aucune intégration ni aucun service externe ne sont prévus, et cette option introduirait des comptes, permissions et dépendances supplémentaires. |

Ainsi, aucune story du périmètre actuel ne promet à Alex un espace de stockage sécurisé. Si l’équipe décide plus tard d’ajouter une option, elle devra d’abord préciser le besoin et les garanties attendues, puis créer et affiner une user story avant de planifier du développement.

Pour les réussites et la gamification, le classement #28 permet de comparer les équipes, mais **ne fournit pas de badges ni de succès individuels**. La nouvelle story #108 propose des badges liés aux actions de jeu. Elle est rattachée à l'EPIC #27, mais reste dans le backlog : les critères, les badges et leurs seuils doivent être affinés et validés en équipe avant de la passer à « Prêt » ou de la planifier.

### Margueritte — Persona imposé : pharmacienne

| Dimension | Détails |
| --- | --- |
| **Identité** | Margueritte, 68 ans, pharmacienne. |
| **Localisation** | Budapest. |
| **Aisance avec la technologie** | Faible ; elle n’est pas familière avec la technologie. |
| **Plateforme utilisée** | Ordinateur de bureau uniquement, sur un écran 800×600 (« vieille télévision »). |
| **Besoin pour P1X3L** | Pouvoir utiliser et parcourir la toile sur un petit écran de bureau à basse résolution. |
| **User story liée** | La navigation sur la toile (#16) inclut un critère d’acceptation pour l’usage en 800×600. |

## Traçabilité des personas vers le backlog

Ces liens indiquent les user stories existantes les plus proches des besoins. Ils ne signifient pas que chaque besoin est déjà implémenté.

| Persona | Besoin lié à P1X3L | User stories associées |
| --- | --- | --- |
| Alex — artiste et stratège | Suivre la toile et les dessins de sa communauté | Voir la toile en direct (#15), demander un modèle à l’IA (#24) |
| Sam | Commencer rapidement et jouer sur smartphone | Naviguer sur la toile (#16), créer un compte (#18), poser un pixel (#21) |
| Léa | Surveiller et modérer les actions | Nettoyer une zone (#31), bannir un joueur (#32) |
| Alex — persona imposé | Comparer les équipes et voir leur progression ; besoin de stockage sécurisé à arbitrer, hors périmètre actuel | Voir le classement des équipes (#28) |
| Margueritte | Parcourir la toile avec un écran 800×600 | Naviguer sur la toile (#16) |
