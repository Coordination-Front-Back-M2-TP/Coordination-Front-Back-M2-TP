# Déploiement continu

Ce document décrit la CD du projet : ce qui est publié, comment publier une version, et comment la mettre en ligne. Le pourquoi du flow est dans [strategie-de-branches.md](strategie-de-branches.md). Le workflow est [.github/workflows/cd.yml](../.github/workflows/cd.yml).

L'application tourne sur le NAS de Theo. Pour la sécurité du NAS, GitHub ne peut pas s'y connecter : la CD publie des images Docker sur GHCR (le registre de GitHub), et le NAS les tire à la main (section 5).

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

Le tag publie tout seul les images de production. Il reste à les mettre en ligne sur le NAS (section 5). Si la vérification échoue parce que staging n'avait pas fini, relancer le workflow du tag (Re-run all jobs) une fois staging terminé.

## 3. Revenir à la version précédente

Dans l'onglet Actions, ouvrir l'exécution du workflow « Déploiement continu » de l'ancien tag, puis « Re-run all jobs ». Elle remet `latest` sur les images de ce tag. Sur le NAS, relancer la section 5 avec cet ancien tag. La release existe déjà : elle n'est pas recréée.

Une base de données migrée ne revient pas en arrière toute seule. [[À préciser quand le projet a une base de données.]]

## 4. Configuration

La publication n'a besoin d'aucun secret : le workflow utilise le jeton fourni par GitHub, avec le droit `packages: write`.

Les variables suivantes se règlent dans Settings, Secrets and variables, Actions. Elles servent seulement à afficher l'adresse dans les environnements GitHub.

| Nom | Type | Rôle |
| --- | --- | --- |
| `STAGING_URL` | Variable, facultative | Adresse publique de staging |
| `PRODUCTION_URL` | Variable, facultative | Adresse publique de la production |

## 5. Mettre en ligne sur le NAS

Seul Theo le fait, sur le NAS. Le fichier [deploy/compose.yml](../deploy/compose.yml) décrit la production : le front (nginx) sert les fichiers construits et transmet `/api` au back, WebSocket compris. Le reverse proxy du NAS envoie le sous-domaine vers le front, port 8080, avec « Websocket Support » activé.

Le dépôt est privé, donc les images aussi : le NAS se connecte à GHCR une fois, avec un jeton personnel limité à `read:packages`.

```bash
docker login ghcr.io -u <compte GitHub>
VERSION=v0.1.0 docker compose -f deploy/compose.yml pull
VERSION=v0.1.0 docker compose -f deploy/compose.yml up -d
curl -fsS https://<sous-domaine>/api/health
```

Pour revenir en arrière, relancer les mêmes commandes avec la version précédente.

## 6. Ce qu'il reste à brancher

- **Staging** : les images `staging` sont publiées à chaque merge, mais rien ne les fait tourner. [[À décider en équipe : un second sous-domaine sur le NAS, ou les lancer en local avec `VERSION=staging`.]]
- **Version en ligne** : `/api/health` dit que le back répond, pas quelle version tourne. Une route qui renvoie la version (lue dans le label `org.opencontainers.image.revision`) permettrait de le vérifier. [[À ajouter avec le back.]]
- **Base de données** : le compose n'en a pas encore. Elle ira dans le réseau `interne`, avec un volume pour ses données.
