# Installer P1X3L

Ce guide part d'un poste vide et va jusqu'au projet lancé en local : le back (API Node.js) et le front (React), chacun dans son terminal. Toutes les commandes se lancent depuis la racine du dépôt.

## 1. Prérequis

| Outil | Version | Vérifier |
| --- | --- | --- |
| Git | Une version récente | `git --version` |
| Node.js, avec npm | 22.12 ou plus (testé avec la 24.14) | `node --version` |

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

Rien à configurer pour l'instant : le projet n'a pas de fichier `.env`. Le back écoute sur le port 3000, et le front envoie ses appels `/api` vers ce port (`front/vite.config.js`). La variable `PORT` change le port du back, mais le front ne le suivrait pas : la laisser vide en local.

Aucun secret ne va dans le dépôt : `.env` est ignoré par Git. Les valeurs de `staging` et de `production` sont dans les secrets et variables Actions du dépôt : voir [docs/deploiement.md](docs/deploiement.md).

## 4. Installer les dépendances

Back :

```bash
npm ci --prefix back
```

Front :

```bash
npm ci --prefix front
```

Chaque commande se termine par `added … packages`. `npm ci` installe exactement les versions du `package-lock.json`.

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

## 6. Vérifier que ça marche

- Le back répond sur `http://localhost:3000/api/health` : `{"status":"ok"}`.
- Le front s'ouvre sur `http://localhost:5173` : la page affiche « P1X3L » et « Back : ok ».

## 7. Tests et lint

| But | Commande |
| --- | --- |
| Tests du back | `npm test --prefix back` |
| Lint du front | `npm run lint --prefix front` |
| Build du front | `npm run build --prefix front` |

Le front n'a pas encore de tests, et le back pas encore de lint. La CI lance les mêmes commandes sur chaque PR ([CONTRIBUTING.md](CONTRIBUTING.md), section 11).

## 8. Problèmes fréquents

| Symptôme | Cause | Solution |
| --- | --- | --- |
| Sous Windows, `npm run` affiche « … n'est pas reconnu en tant que commande interne ou externe », puis `Cannot find module` | Le chemin du dossier contient « & » : `cmd.exe`, qu'utilise npm, coupe la commande à ce caractère | Cloner le dépôt dans un dossier sans « & » |
| Le back s'arrête avec `EADDRINUSE` | Un autre programme occupe le port 3000, peut-être un back déjà lancé | Fermer ce programme, puis relancer le back |
| Le front affiche « Back : injoignable » | Le back n'est pas lancé | Lancer le back (section 5) |

Un problème absent de ce tableau : ouvrir une issue avec le gabarit Bug, puis l'ajouter ici une fois résolu.
