# Déploiement continu

Ce document décrit la CD du projet : ce qui est publié, comment un changement part en production, et comment revenir en arrière. Le pourquoi du flow est dans [strategie-de-branches.md](strategie-de-branches.md). Le workflow est [.github/workflows/cd.yml](../.github/workflows/cd.yml).

L'application tourne sur le NAS de Theo. Pour la sécurité du NAS, GitHub ne peut pas s'y connecter : la CD publie des images Docker sur GHCR (le registre de GitHub), et c'est le NAS qui vient les chercher (section 5).

## 1. Ce qui se passe tout seul

| Événement | Résultat |
| --- | --- |
| Merge d'une PR sur `main` | La CI tourne sur `main` |
| CI de `main` verte | Les images `p1x3l-front` et `p1x3l-back` sont construites et publiées avec le tag `sha-<commit>`, puis `latest` |
| `latest` a changé | Le NAS met la nouvelle version en ligne dans les 10 minutes (section 5) |

Il n'y a ni tag de version ni étape manuelle : merger, c'est mettre en production. Si la CI de `main` échoue, rien n'est publié et la production ne bouge pas.

Les images sont dans l'onglet Packages de l'organisation : `ghcr.io/coordination-front-back-m2-tp/p1x3l-front` et `ghcr.io/coordination-front-back-m2-tp/p1x3l-back`.

Une seule publication tourne à la fois. Celle en cours va au bout, la suivante attend. Si deux PR sont mergées coup sur coup, seul le dernier commit de `main` reçoit `latest` : le premier garde son image `sha-<commit>`, et la production passe directement au second.

La version en ligne est le commit renvoyé par `/api/health`. Les tags `v0.1.0`, `v0.1.1` et `v0.2.0` datent de l'ancien flow, où un tag déclenchait la mise en production : ils restent dans l'historique, et plus aucun n'est posé.

## 2. Avant de merger

Comme chaque merge part en production, la relecture est la dernière vérification.

- La PR change [deploy/compose.yml](../deploy/compose.yml) (volume, variable, réseau, port) : reporter le changement sur le NAS avant de merger (section 5, « Le fichier Compose du NAS »). Watchtower remplace l'image, pas la configuration du conteneur.
- La PR ajoute une migration de base de données : elle s'applique au démarrage du back, et un retour arrière du code ne la défait pas.
- Après le merge, vérifier la production : `https://p1x3l.theo-stoffelbach.fr/api/health` doit renvoyer le commit mergé.

## 3. Revenir à la version précédente

Le chemin normal est une PR de revert sur `main` (`git revert <commit>`), relue et mergée comme les autres : elle part en production toute seule.

Si la production est en panne et que le revert ne peut pas attendre, épingler l'ancienne image sur le NAS. Dans `/volume2/docker/p1x3l/docker-compose.yml`, remplacer `:latest` par `:sha-<commit>` (le dernier commit sain) pour le service en panne, puis :

```bash
sudo DOCKER_CONFIG=/volume2/docker/watchtower-central docker compose up -d --wait
```

Une image épinglée ne suit plus `latest` : remettre `:latest` une fois `main` corrigée.

Une base de données migrée ne revient pas en arrière toute seule. [[À préciser : procédure de retour arrière d'une migration.]]

## 4. Configuration

La publication n'a besoin d'aucun secret : le workflow utilise le jeton fourni par GitHub, avec le droit `packages: write`.

La variable suivante se règle dans Settings, Secrets and variables, Actions. Elle sert seulement à afficher l'adresse dans l'environnement GitHub `production`.

| Nom | Type | Rôle |
| --- | --- | --- |
| `PRODUCTION_URL` | Variable, facultative | Adresse publique de la production |

## 5. Mise en ligne sur le NAS

La production est en ligne sur <https://p1x3l.theo-stoffelbach.fr> depuis la `v0.1.0` (11 octobre 2026).

Sur le NAS, Watchtower vérifie toutes les 10 minutes si l'image `latest` de `p1x3l-front` et de `p1x3l-back` a changé, et recrée le conteneur si c'est le cas. `latest` change à chaque merge sur `main` dont la CI est verte.

### Ce qui tourne

| Élément | Valeur |
| --- | --- |
| Conteneurs | `p1x3l_front` (nginx, port 8080) et `p1x3l_back` (Express, port 3000) |
| Données | Volume `p1x3l_canvas-data`, monté dans `/data` du back : la base SQLite de la toile |
| Réseaux | `p1x3l_public` : le reverse proxy et le front seulement. `p1x3l_internal` : le front et le back, sans accès à Internet |
| Ports ouverts sur le NAS | Aucun : tout passe par le reverse proxy (Nginx Proxy Manager), en HTTPS |
| Vérification | `https://p1x3l.theo-stoffelbach.fr/api/health` renvoie `{"status":"ok"}` |

Le front sert les fichiers construits et transmet `/api` ainsi que `/socket.io/` au back, WebSocket compris : le navigateur ne parle qu'à une seule origine, comme en local avec le proxy de Vite. Le flux de la toile utilise le chemin Socket.IO par défaut `/socket.io/`.

### Le fichier Compose du NAS

Le NAS n'utilise pas [deploy/compose.yml](../deploy/compose.yml) tel quel. Sa copie, `/volume2/docker/p1x3l/docker-compose.yml`, est durcie : conteneurs nommés `p1x3l_front` et `p1x3l_back`, système de fichiers en lecture seule (`read_only: true`), aucune capacité (`cap_drop: ALL`), sous-réseau fixe.

Watchtower remplace l'image d'un conteneur et garde sa configuration. Un changement de `deploy/compose.yml` n'arrive donc pas tout seul sur le NAS : il faut le reporter à la main dans la copie, puis recréer les conteneurs.

```bash
cd /volume2/docker/p1x3l
sudo DOCKER_CONFIG=/volume2/docker/watchtower-central docker compose up -d --wait
sudo docker logs --tail 20 p1x3l_back
```

Comme le back est en lecture seule, tout dossier où il écrit a besoin d'un volume. C'est le cas de `/data`, qui porte la base de données.

Le 19 novembre 2026, la première version avec une base de données a mis le back en boucle de redémarrage (`unable to open database file: /data/p1x3l.db`) : la copie du NAS n'avait pas le volume `canvas-data:/data`. L'ajouter et recréer les conteneurs a suffi.

### Réglages du reverse proxy

Le Proxy Host de Nginx Proxy Manager, champ par champ. Un champ absent de ce tableau n'existe pas dans la fenêtre.

| Onglet | Champ | Valeur |
| --- | --- | --- |
| Details | Domain Names | `p1x3l.theo-stoffelbach.fr` |
| Details | Scheme | `http` : le HTTPS s'arrête au reverse proxy, la suite reste dans le réseau Docker |
| Details | Forward Hostname / IP | `p1x3l_front` (nom du conteneur, jamais une IP) |
| Details | Forward Port | `8080` (port interne du front) |
| Details | Access List | Publicly Accessible |
| Details | Cache Assets | Désactivé : il pourrait servir d'anciens fichiers après une mise à jour |
| Details | Block Common Exploits | Activé |
| Details | Websockets Support | Activé : le temps réel passe par WebSocket |
| Custom Locations | (aucune) | Le front transmet déjà `/api` et `/socket.io/` au back |
| SSL | SSL Certificate | Request a new SSL Certificate (Let's Encrypt), conditions acceptées |
| SSL | Force SSL | Activé : HTTP redirige vers HTTPS |
| SSL | HTTP/2 Support | Activé |
| SSL | HSTS Enabled | Désactivé : le NAS ajoute déjà cet en-tête à tous les sites, il serait en double |
| SSL | HSTS Sub-domains | Désactivé |
| SSL | Use DNS Challenge | Désactivé : la validation HTTP suffit |
| SSL | Advanced → Trust Upstream Forwarded Proto Headers | Désactivé : aucun autre proxy devant |
| Roue dentée | Custom Nginx Configuration | `proxy_read_timeout 3600s;` et `proxy_send_timeout 3600s;` : sans eux, une connexion WebSocket inactive est coupée au bout de 60 secondes |

Les en-têtes de sécurité (HSTS, `X-Frame-Options`, `Referrer-Policy`…) viennent de la configuration commune du NAS : ne pas les ajouter dans la roue dentée.

### Première installation (déjà faite)

Pour mémoire, ou pour réinstaller. Les commandes se lancent en root (`sudo`) sur le NAS, dans `/volume2/docker/p1x3l`. Les images sont privées : `DOCKER_CONFIG` désigne les identifiants GHCR du NAS (un jeton `read:packages`). Sans lui, Docker répond `denied`.

```bash
docker network create --subnet 10.240.0.48/28 p1x3l_public
DOCKER_CONFIG=/volume2/docker/watchtower-central docker compose pull
DOCKER_CONFIG=/volume2/docker/watchtower-central docker compose up -d --wait
docker network connect p1x3l_public nginx-proxy-manager
```

`manifest unknown` au `pull` veut dire que `latest` n'existe pas encore : aucune publication n'a abouti.

### Lancer une version en local

Le fichier [deploy/compose.yml](../deploy/compose.yml) reprend la production. `VERSION` vaut `latest`, ou `sha-<commit>` pour un commit précis :

```bash
VERSION=latest docker compose -f deploy/compose.yml up -d
```

## 6. Ce qu'il reste à brancher

- **Pré-production** : il n'y a plus d'environnement de staging. Un changement se vérifie en local et dans la CI avant le merge. [[À décider en équipe : faut-il un environnement de pré-production sur le NAS.]]
- **Base de données** : SQLite est stockée dans le volume Docker `canvas-data`, monté dans `/data` du back. Les migrations sont appliquées au démarrage du back. Sauvegarder ce volume avant toute opération de maintenance qui pourrait supprimer les données.
