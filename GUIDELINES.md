<!--
Modèle de GUIDELINES.md (09/10/2026). À copier à la racine d'un projet sous le nom GUIDELINES.md.
Remplacer chaque [[à remplir]] (chercher « [[ » pour n'en oublier aucun), supprimer ce qui ne sert pas,
puis supprimer ce commentaire.

Rôle du fichier : comment on écrit le code (structure, nommage, contrat entre le front et le back, tests,
sécurité). Le CONTRIBUTING.md dit comment on travaille en équipe (tickets, branches, PR) : ne pas le répéter
ici, y renvoyer. Le TD POC cite ce fichier (« GUILDELINES.md » dans le sujet) parmi la documentation
attendue, sans barème propre : il compte dans la mise en forme du Markdown.

Conseils
- N'écrire une règle que si l'équipe l'applique. Une règle qu'un outil vérifie (lint, format, CI) se cite
  avec l'outil, sans la détailler.
- Garder les exemples courts : un exemple vaut mieux qu'un paragraphe.
-->

# Conventions de code de [[Nom du projet]]

Ces règles valent pour tout le code du dépôt. Les relecteurs s'en servent pendant la revue ([CONTRIBUTING.md](CONTRIBUTING.md), section 10). Pour changer une règle, ouvrir une issue, comme pour le reste.

## 1. Principes

- Lisible avant d'être astucieux : le code se relit plus souvent qu'il ne s'écrit.
- Une fonction a un seul rôle et reste courte.
- [[Principe propre à l'équipe.]]

## 2. Structure du dépôt

```text
[[front/]]    [[application front]]
[[back/]]     [[API]]
docs/         documentation (stratégie de branches, gestion de projet)
```

[[Où va un nouveau composant, une nouvelle route, un nouveau test.]]

## 3. Nommage

| Élément | Convention | Exemple |
| --- | --- | --- |
| Fichiers | [[kebab-case]] | `[[exemple]]` |
| Variables et fonctions | [[camelCase]] | `[[exemple]]` |
| Composants et classes | [[PascalCase]] | `[[exemple]]` |
| Constantes | [[MAJUSCULES_AVEC_TIRETS_BAS]] | `[[exemple]]` |
| Routes d'API | [[noms au pluriel, en minuscules]] | `[[exemple]]` |

Langue du code : [[anglais pour le code, français pour la documentation et les tickets]].

## 4. Front

- Framework : [[nom et version]].
- [[Un composant par fichier, où vont les appels à l'API, où vit l'état de l'application.]]
- Accessibilité : niveau [[AA]] du WCAG. Chaque champ a un libellé, tout se fait au clavier, les contrastes sont suffisants.
- Styles : [[outil]]. Les couleurs, polices et espacements viennent de `DESIGN.md`.

## 5. Back

- Framework : [[nom et version]].
- [[Les couches : routes, logique métier, accès aux données.]]
- Chaque entrée de l'API est validée avant d'être utilisée.
- Une erreur renvoie le bon code HTTP et un corps au format de la section 6.

## 6. Contrat entre le front et le back

Le contrat est la liste des routes de l'API, avec ce qu'elles reçoivent et ce qu'elles renvoient. Le front et le back s'appuient dessus pour avancer en parallèle.

- Où il est décrit : [[fichier OpenAPI, par exemple docs/api.yaml, ou page de documentation]].
- Quand une route change, le contrat change dans la même PR, et l'autre partie de l'équipe est prévenue dans l'issue.
- Données en JSON, clés en [[camelCase]], dates au format ISO 8601 (`2026-10-09T14:30:00Z`).
- Un changement qui casse le contrat demande l'accord du front et du back avant le merge, ou une nouvelle version de l'API ([[/api/v2]]).

Format d'une erreur :

```json
{ "error": { "code": "[[CODE_ERREUR]]", "message": "[[Message lisible]]" } }
```

## 7. Tests

- Outils : [[outil de test du front]], [[outil de test du back]].
- Une nouvelle fonctionnalité a au moins un test. Un bug corrigé reçoit un test qui l'aurait détecté.
- Les tests passent en local avant d'ouvrir la PR. La CI les relance.

## 8. Lint et format

- Outils : [[outil de lint]], [[outil de format]]. La CI les vérifie. Les commandes sont dans [INSTALL.md](INSTALL.md).
- Une règle désactivée l'est avec un commentaire qui dit pourquoi.

## 9. Sécurité

- Aucun secret dans le dépôt : les clés passent par des variables d'environnement ([INSTALL.md](INSTALL.md), section 3).
- Les dépendances viennent du registre officiel, avec une version fixée. [[Outil de mise à jour des dépendances.]]
- Aucune donnée personnelle ni aucun jeton dans les logs.

## 10. Commentaires et documentation

- Un commentaire dit pourquoi, pas ce que fait le code.
- Langue des commentaires : [[français]].
- Une route, une variable d'environnement ou une commande qui change met à jour le contrat d'API, [INSTALL.md](INSTALL.md) ou [README.md](README.md) dans la même PR.
