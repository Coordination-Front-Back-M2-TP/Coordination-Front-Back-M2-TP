# 👥 Personas Produit — Project Pixel War

Ce document définit les personas utilisateurs pour la vision produit du projet **Pixel War**. Ces profils permettent d'orienter le développement du MVP et d'assurer que chaque fonctionnalité réponde à un besoin réel.

---

## 🎨 Persona 1 : Alex — L'Artiste / Le Stratège de Communauté

> *"Je veux qu'on synchronise 50 personnes pour poser notre logo en entier sans qu'un troll détruise nos pixels."*

| Dimension | Détails |
| --- | --- |
| **Identité** | **Alex**, 22 ans, étudiant en informatique, streamer et modérateur d'un serveur Discord. |
| **Profil & Usage** | Joueur très actif. Organise des "raids" de placement de pixels avec sa communauté. |
| **Objectifs** | • Reproduire une œuvre complexe (Pixel Art) avec son groupe.<br>• Défendre la zone acquise contre les attaques adverses. |
| **Frustrations** | • Absences d'outils pour superposer un modèle (overlay).<br>• Temps de recharge (cooldown) mal indiqué.<br>• Attaques de bots automatisés non modérés. |
| **Impact sur le MVP** | Nécessite un système d'**overlay (calque transparent)**, un **Canvas synchrone via WebSocket** et un **compteur de cooldown** très précis. |

---

## 🕹️ Persona 2 : Sam — Le Joueur Casual

> *"J'ai 2 minutes à perdre entre deux cours, je pose un pixel pour voir ce qui se passe."*

| Dimension | Détails |
| --- | --- |
| **Identité** | **Sam**, 19 ans, navigue sur la plateforme principalement depuis son smartphone. |
| **Comportement** | Connexion rapide et spontanée. Pose quelques pixels au hasard ou participe à une zone de couleur unie. |
| **Objectifs** | • S'amuser immédiatement sans configuration complexe.<br>• Voir l'impact immédiat de son pixel sur la carte globale. |
| **Frustrations** | • Inscription trop longue avec vérification d'email stricte.<br>• Navigation mobile difficile (zoom et déplacement sur le canvas). |
| **Impact sur le MVP** | Nécessite un **processus d'inscription ultra-rapide**, une **palette de couleurs accessible** et un **pan/zoom fluide sur mobile**. |

---

## 🛡️ Persona 3 : Léa — La Modératrice / Administrateur

> *"Je dois m'assurer que la carte reste propre, sans contenu haineux ni bots automatisés."*

| Dimension | Détails |
| --- | --- |
| **Identité** | **Léa**, 25 ans, développeuse web et membre de l'équipe d'organisation. |
| **Comportement** | Surveille le Canvas, analyse l'historique des clics et intervient en cas de comportement suspect. |
| **Objectifs** | • Maintenir un environnement sain pour tous les utilisateurs.<br>• Identifier et bannir rapidement les scripts/bots de spam. |
| **Frustrations** | • Absence d'outils pour annuler les actions d'un utilisateur (rollback).<br>• Manque de logs clairs sur l'origine des pixels posés. |
| **Impact sur le MVP** | Nécessite des **rôles utilisateurs (`Admin` vs `User`)**, un **historique des clics (User ID $\rightarrow$ X/Y)** et une **API de bannissement / nettoyage de zone**. |

---

## 🔗 Matrice de Traçabilité : Personas $\rightarrow$ EPICS Fullstack

| Persona | EPIC associée | Sous-tâche Front-end | Sous-tâche Back-end |
| --- | --- | --- | --- |
| **Alex** | **EPIC 2 : Canvas Temps Réel** | Canvas HTML5/WebGL + Overlay | WebSocket server & diffusion d'état |
| **Sam** | **EPIC 1 : Auth & UX Mobile** | Interface responsive + Palette | Inscription / Auth JWT légère |
| **Léa** | **EPIC 4 : Modération & Anti-Bot** | Dashboard Admin + Outil de zone | Rate limiting + Endpoint de Rollback |