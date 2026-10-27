# Déploiement continu

Ce document décrit la CD du projet : ce qui est publié, comment publier une version, et comment la mettre en ligne. Le pourquoi du flow est dans [strategie-de-branches.md](strategie-de-branches.md). Le workflow est [.github/workflows/cd.yml](../.github/workflows/cd.yml).

L'application tourne sur le NAS de Theo. Pour la sécurité du NAS, GitHub ne peut pas s'y connecter : la CD publie des images Docker sur GHCR (le registre de GitHub), et c'est le NAS qui vient les chercher (section 5).

## 1. Ce qui se passe tout seul

| Événement | Job | Résultat |
| --- | --- | --- |
| Merge d'une PR sur `main` | Publier les images (staging) | Les images `p1x3l-front` et `p1x3l-back` sont construites et publiées avec les tags `sha-<commit>` et `staging` |
| Push sur une branche `release/X.Y` (correctif) | Publier les images (staging) | Pareil |
| Push d'un tag `vX.Y.Z` | Vérifier la version | Le tag suit semver, il pointe sur `main` ou `release/X.Y`, et ce commit a déjà été publié en staging |
| Vérification réussie | Publier les images (production) | Les images `sha-<commit>` reçoivent les tags `vX.Y.Z` et `latest`, sans être reconstruites |
| Images de production publiées | Publier la release GitHub | La release `vX.Y.Z` est créée, avec les notes générées à partir des PR |

Les images sont dans l'onglet Packages de l'organisation : `ghcr.io/coordination-front-back-m2-tp/p1x3l-front` et `ghcr.io/coordination-front-back-m2-tp/p1x3l-back`.

Une seule publication tourne à la fois par environnement. Celle en cours va au bout, la suivante attend.

Un tag avec un suffixe (`v1.0.0-rc.1`) donne une pré-release.

## 2. Mettre une version en production

1. Choisir un commit déjà publié en staging : l'onglet Actions, workflow « Déploiement continu », liste les publications.
2. Choisir le numéro avec semver (section 7 de [CONTRIBUTING.md](../CONTRIBUTING.md)).
3. Poser le tag sur ce commit et le pousser :

```bash
git switch main
git pull
git tag v0.1.0
git push origin v0.1.0
```

Le tag publie tout seul les images de production. Le NAS les met en ligne dans les 10 minutes (section 5). Si la vérification échoue parce que staging n'avait pas fini, relancer le workflow du tag (Re-run all jobs) une fois staging terminé.

## 3. Revenir à la version précédente

Dans l'onglet Actions, ouvrir l'exécution du workflow « Déploiement continu » de l'ancien tag, puis « Re-run all jobs ». Elle remet `latest` sur les images de ce tag. Le NAS la remet en ligne dans les 10 minutes. La release existe déjà : elle n'est pas recréée.

Une base de données migrée ne revient pas en arrière toute seule. [[À préciser quand le projet a une base de données.]]

## 4. Configuration

La publication n'a besoin d'aucun secret : le workflow utilise le jeton fourni par GitHub, avec le droit `packages: write`.

Les variables suivantes se règlent dans Settings, Secrets and variables, Actions. Elles servent seulement à afficher l'adresse dans les environnements GitHub.

| Nom | Type | Rôle |
| --- | --- | --- |
| `STAGING_URL` | Variable, facultative | Adresse publique de staging |
| `PRODUCTION_URL` | Variable, facultative | Adresse publique de la production |

## 5. Mise en ligne sur le NAS

La production est en ligne sur <https://p1x3l.theo-stoffelbach.fr> depuis la `v0.1.0` (11 octobre 2026).

Sur le NAS, Watchtower vérifie toutes les 10 minutes si l'image `latest` de `p1x3l-front` et de `p1x3l-back` a changé, et recrée le conteneur si c'est le cas. Comme `latest` ne bouge qu'au tag `vX.Y.Z`, un merge sur `main` ne touche pas la production.

### Ce qui tourne

| Élément | Valeur |
| --- | --- |
| Conteneurs | `p1x3l_front` (nginx, port 8080) et `p1x3l_back` (Express, port 3000) |
| Réseaux | `p1x3l_public` : le reverse proxy et le front seulement. `p1x3l_internal` : le front et le back, sans accès à Internet |
| Ports ouverts sur le NAS | Aucun : tout passe par le reverse proxy (Nginx Proxy Manager), en HTTPS |
| Vérification | `https://p1x3l.theo-stoffelbach.fr/api/health` renvoie `{"status":"ok"}` |

Le front sert les fichiers construits et transmet `/api` au back, WebSocket compris : le navigateur ne parle qu'à une seule origine, comme en local avec le proxy de Vite.

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
| Custom Locations | (aucune) | Le front transmet déjà `/api` au back |
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

Pour mémoire, ou pour réinstaller. Les commandes se lancent en root sur le NAS, dans `/volume2/docker/p1x3l`. Les images sont privées : `DOCKER_CONFIG` désigne les identifiants GHCR du NAS (un jeton `read:packages`). Sans lui, Docker répond `denied`.

```bash
docker network create --subnet 10.240.0.48/28 p1x3l_public
DOCKER_CONFIG=/volume2/docker/watchtower-central docker compose pull
DOCKER_CONFIG=/volume2/docker/watchtower-central docker compose up -d --wait
docker network connect p1x3l_public nginx-proxy-manager
```

`manifest unknown` au `pull` veut dire que `latest` n'existe pas encore : aucun tag `vX.Y.Z` n'a été publié.

### Lancer une version en local

Le fichier [deploy/compose.yml](../deploy/compose.yml) reprend la production et lance une version précise :

```bash
VERSION=v0.1.0 docker compose -f deploy/compose.yml up -d
```

## 6. Ce qu'il reste à brancher

- **Staging** : les images `staging` sont publiées à chaque merge, mais rien ne les fait tourner. [[À décider en équipe : un second sous-domaine sur le NAS, ou les lancer en local avec `VERSION=staging`.]]
- **Base de données** : le compose n'en a pas encore. Elle ira dans le réseau `interne`, avec un volume pour ses données.
