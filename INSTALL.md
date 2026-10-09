<!--
Modèle de INSTALL.md (09/10/2026). À copier à la racine d'un projet sous le nom INSTALL.md.
Remplacer chaque [[à remplir]] (chercher « [[ » pour n'en oublier aucun), supprimer ce qui ne sert pas,
puis supprimer ce commentaire.

Rôle du fichier : tout ce qu'il faut pour passer d'un poste vide au projet lancé en local.
Le README.md donne le contexte et renvoie ici. Le CONTRIBUTING.md dit comment travailler en équipe,
le GUIDELINES.md comment écrire le code.

Barème du TD POC (voir `TD_ POC.md`) : explications d'installation /2.
- Une personne qui n'a jamais vu le projet doit pouvoir le lancer en suivant les étapes dans l'ordre,
  sans deviner. Tester les étapes sur un clone neuf, si possible sur une autre machine, avant de rendre.
- Une commande par bloc, avec le langage du bloc. Dire ce qu'on doit voir quand l'étape a marché.
- Les commandes ne s'écrivent qu'ici : les autres fichiers renvoient vers ce fichier.
-->

# Installer [[Nom du projet]]

Ce guide part d'un poste vide et va jusqu'au projet lancé en local. Compter [[durée]] minutes.

## 1. Prérequis

| Outil | Version | Vérifier         |
| ----- | ------- | ----------------- |
| Git   | [[version]]        | `git --version` |
| [[Node.js, Python, Docker…]]      | [[version]]        | `[[commande]]`  |

Accès nécessaires : le dépôt GitHub et le board ([TP Coordination Front&amp;Back](https://github.com/orgs/Coordination-Front-Back-M2-TP/projects/1)). [[Autres accès : base de données de test, compte de service…]]

## 2. Récupérer le code

```bash
git clone git@github.com:Coordination-Front-Back-M2-TP/Coordination-Front-Back-M2-TP.git
cd Coordination-Front-Back-M2-TP
```

## 3. Configurer

Copier le fichier d'exemple des variables d'environnement :

```bash
cp .env.example .env
```

| Variable             | Rôle | Valeur en local |
| -------------------- | ----- | --------------- |
| `[[NOM_VARIABLE]]` | [[à quoi elle sert]]      | [[valeur de développement, ou : la demander à la personne responsable]]                |

Aucun secret ne va dans le dépôt : `.env` est ignoré par Git. Les valeurs de `staging` et de `production` sont dans les environnements GitHub (Settings, Environments).

## 4. Installer les dépendances

Back :

```bash
[[commande qui installe le back]]
```

Front :

```bash
[[commande qui installe le front]]
```

[[Si une base de données est nécessaire : comment la lancer, créer le schéma et charger les données de test.]]

## 5. Lancer

Back :

```bash
[[commande qui lance le back]]
```

Front, dans un autre terminal :

```bash
[[commande qui lance le front]]
```

## 6. Vérifier que ça marche

- Le back répond sur [[adresse locale du back]] : [[ce qu'on doit voir]].
- Le front s'ouvre sur [[adresse locale du front]] : [[ce qu'on doit voir]].

## 7. Tests et lint

| But            | Commande         |
| -------------- | ---------------- |
| Tests          | `[[commande]]` |
| Lint et format | `[[commande]]` |

## 8. Problèmes fréquents

| Symptôme | Cause | Solution |
| --------- | ----- | -------- |
| [[Le port est déjà utilisé]]          | [[Un autre programme l'occupe]]      | [[Changer le port dans .env]]         |

Un problème absent de ce tableau : ouvrir une issue avec le gabarit Bug, puis l'ajouter ici une fois résolu.
