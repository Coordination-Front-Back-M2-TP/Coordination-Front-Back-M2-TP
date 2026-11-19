# Installer P1X3L

Ce guide part d'un poste vide et va jusqu'au projet lancé en local : le back (API Node.js) et le front (React), chacun dans son terminal. Toutes les commandes se lancent depuis la racine du dépôt. Pour le parcours d'accueil complet d'un stagiaire ou d'un nouveau membre (accès, premier ticket, conventions et retours de stage), voir [docs/onboarding.md](docs/onboarding.md).

## 1. Prérequis

| Outil | Version | Vérifier |
| --- | --- | --- |
| Git | Une version récente | `git --version` |
| Node.js, avec npm | 22.12 ou plus (testé avec la 24.14) | `node --version` |
| Docker, avec Compose (facultatif, pour tout lancer d'une commande) | Compose 2.22 ou plus (testé avec Docker 28.1 et Compose 2.35) | `docker compose version` |

Accès nécessaires : le dépôt GitHub et le board ([TP Coordination Front&Back](https://github.com/orgs/Coordination-Front-Back-M2-TP/projects/1)). Les deux sont privés : il faut y être invité.

## 2. Récupérer le code

Sous Windows, choisir un dossier dont le chemin ne contient pas « & » : npm ne pourrait pas lancer ses outils (voir section 8).

```bash
git clone https://github.com/Coordination-Front-Back-M2-TP/Coordination-Front-Back-M2-TP.git
```

```bash
cd Coordination-Front-Back-M2-TP
```

Le dépôt est privé : Git demande de se connecter avec un compte GitHub qui y a accès.

## 3. Configurer

Le back utilise SQLite dans `back/prisma/dev.db` par défaut. Il n'y a pas de secret à configurer. Le back écoute sur le port 3000, et le front envoie ses appels `/api` vers ce port (`front/vite.config.js`). La variable `PORT` change le port du back, mais le front ne le suivrait pas : la laisser vide en local.

Aucun secret ne va dans le dépôt : `.env` est ignoré par Git. Les valeurs de la production sont dans les secrets et variables Actions du dépôt : voir [docs/deploiement.md](docs/deploiement.md).

## 4. Installer les dépendances

Racine du dépôt, pour le hook Git qui vérifie les messages de commit ([CONTRIBUTING.md](CONTRIBUTING.md), section 8) :

```bash
npm ci
```

Back :

```bash
npm ci --prefix back
```

Front :

```bash
npm ci --prefix front
```

Chaque commande se termine par `added … packages`. `npm ci` installe exactement les versions du `package-lock.json`.

Initialiser la base locale après l'installation :

```bash
npm run db:migrate:deploy --prefix back
```

Le serveur déployé applique automatiquement les migrations avant de démarrer.

Tests E2E, seulement pour les lancer (section 7) :

```bash
npm ci --prefix e2e
```

```bash
npm exec --prefix e2e -- playwright install chromium
```

La seconde commande télécharge le navigateur Chromium utilisé par Playwright, une seule fois par poste.

## 5. Lancer

Back :

```bash
npm run dev --prefix back
```

Le terminal affiche `Back P1X3L prêt : http://localhost:3000/api/health`. Le back redémarre tout seul quand un fichier change.

Front, dans un autre terminal :

```bash
npm run dev --prefix front
```

Vite affiche l'adresse du front : `http://localhost:5173/`.

### Variante : tout lancer d'une commande avec Docker

Avec Docker, le back et le front démarrent ensemble, sans installer leurs dépendances sur le poste (la section 4 reste utile pour lancer les tests) :

```bash
docker compose up --watch
```

Le premier lancement construit les images, en quelques minutes. Le front attend que le back réponde, puis les adresses sont les mêmes qu'en local : `http://localhost:3000` et `http://localhost:5173`. Avec `--watch`, chaque fichier modifié dans `back/src` ou `front/src` est recopié dans son conteneur : le back redémarre et la page du front se recharge. Une nouvelle dépendance ou une nouvelle migration reconstruit l'image toute seule.

- Arrêter : `Ctrl+C`, puis `docker compose down`.
- La base SQLite est gardée dans un volume Docker d'un lancement à l'autre ; `docker compose down -v` la remet à zéro.
- La configuration est dans [compose.yml](compose.yml) ; les Dockerfiles du back et du front ont une cible `dev` pour ce lancement, et leur dernière étape reste l'image de production ([docs/deploiement.md](docs/deploiement.md)).

## 6. Vérifier que ça marche

- Le back répond sur `http://localhost:3000/api/health` : `{"status":"ok"}`.
- La documentation de l'API (Swagger UI) est accessible sur `http://localhost:3000/api/docs` (détails dans [docs/api.md](docs/api.md)).
- Le front s'ouvre sur `http://localhost:5173` : la page affiche « P1X3L » et « Back : ok ».

La page affiche aussi la toile en direct avec le contrat de lecture et d’abonnement Socket.IO du back. Le proxy Vite transmet `/socket.io/` au port 3000, avec le passage à WebSocket. Le comportement, les états d’erreur et les tests sont décrits dans [docs/toile-front.md](docs/toile-front.md) et [docs/toile-back.md](docs/toile-back.md).

## 7. Tests et lint

| But | Commande |
| --- | --- |
| Tests du back | `npm test --prefix back` |
| Tests du front | `npm test --prefix front` |
| Lint du front | `npm run lint --prefix front` |
| Build du front | `npm run build --prefix front` |
| Tests E2E (Playwright) | `npm test --prefix e2e` |
| Atelier composants (Ladle) | `npm run ladle --prefix front` |

La documentation des composants front avec Ladle est décrite dans [docs/composants.md](docs/composants.md). Les tests front utilisent Vitest et Testing Library, avec jsdom pour le rendu React. Le back n'a pas encore de lint. La CI lance les mêmes commandes sur chaque PR ([CONTRIBUTING.md](CONTRIBUTING.md), section 11).

Les tests E2E lancent eux-mêmes un serveur de test sur le port 3000 et le front : arrêter un back local avant de les lancer, et fermer les programmes qui occuperaient le port 5173. Leur fonctionnement (outil choisi, serveur « contrat », scénarios) est décrit dans [docs/tests-e2e.md](docs/tests-e2e.md).

Les états affichés lorsqu'une connexion ou un rendu échoue sont décrits dans [docs/erreurs-front.md](docs/erreurs-front.md).

## 8. Problèmes fréquents

| Symptôme | Cause | Solution |
| --- | --- | --- |
| Sous Windows, `npm run` affiche « … n'est pas reconnu en tant que commande interne ou externe », puis `Cannot find module` | Le chemin du dossier contient « & » : `cmd.exe`, qu'utilise npm, coupe la commande à ce caractère | Cloner le dépôt dans un dossier sans « & » |
| Le back s'arrête avec `EADDRINUSE` | Un autre programme occupe le port 3000, peut-être un back déjà lancé | Fermer ce programme, puis relancer le back |
| Le front affiche « Back : injoignable » | Le back n'est pas lancé | Lancer le back (section 5) |
| `docker compose up` s'arrête avec « port is already allocated » | Un back ou un front lancé à la main occupe déjà le port 3000 ou 5173 | Arrêter le lancement manuel : on utilise l'un ou l'autre, pas les deux |
| Avec Docker, une modification n'est pas prise en compte | Le lancement s'est fait sans `--watch` | Relancer avec `docker compose up --watch` |

Un problème absent de ce tableau : ouvrir une issue avec le gabarit Bug, puis l'ajouter ici une fois résolu.
