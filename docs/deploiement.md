# Déploiement continu

Ce document décrit la CD du projet : ce qui part où, comment publier une version, et ce qu'il reste à brancher. Le pourquoi du flow est dans [strategie-de-branches.md](strategie-de-branches.md). Le workflow est [.github/workflows/cd.yml](../.github/workflows/cd.yml).

## 1. Ce qui se passe tout seul

| Événement | Job | Résultat |
| --- | --- | --- |
| Merge d'une PR sur `main` | Déployer en staging | Le commit part en staging |
| Push sur une branche `release/X.Y` (correctif) | Déployer en staging | Le commit part en staging |
| Push d'un tag `vX.Y.Z` | Vérifier la version | Le tag suit semver, il pointe sur `main` ou `release/X.Y`, et ce commit a déjà été déployé en staging |
| Vérification réussie | Déployer en production | La version part en production |
| Production déployée | Publier la release GitHub | La release `vX.Y.Z` est créée, avec les notes générées à partir des PR |

Un seul déploiement tourne à la fois par environnement. Celui en cours va au bout, le suivant attend.

Un tag avec un suffixe (`v1.0.0-rc.1`) donne une pré-release.

## 2. Mettre une version en production

1. Vérifier en staging le commit à publier. L'onglet Actions, workflow « Déploiement continu », indique ce qui y tourne.
2. Choisir le numéro avec semver (section 7 de [CONTRIBUTING.md](../CONTRIBUTING.md)).
3. Poser le tag sur ce commit et le pousser :

```bash
git switch main
git pull
git tag v0.1.0
git push origin v0.1.0
```

Le tag part tout seul en production. Si la vérification échoue parce que staging n'avait pas fini, relancer le workflow du tag (Re-run all jobs) une fois staging terminé.

## 3. Revenir à la version précédente

Dans l'onglet Actions, ouvrir l'exécution du workflow « Déploiement continu » de l'ancien tag, puis « Re-run all jobs ». Elle redéploie ce tag en production. La release existe déjà : elle n'est pas recréée.

Une base de données migrée ne revient pas en arrière toute seule. [[À préciser quand le projet a une base de données.]]

## 4. Configuration

Les adresses et les hooks se règlent dans GitHub, jamais dans le dépôt : Settings, Secrets and variables, Actions. Le dépôt est privé sur le plan gratuit, qui ne donne pas accès aux secrets d'environnement : tout est donc au niveau du dépôt, préfixé par l'environnement. Les environnements `staging` et `production` gardent l'historique des déploiements.

| Nom | Type | Rôle |
| --- | --- | --- |
| `STAGING_DEPLOY_HOOK_URL` | Secret | Hook de déploiement de l'hébergeur pour staging |
| `PRODUCTION_DEPLOY_HOOK_URL` | Secret | Hook de déploiement de l'hébergeur pour la production |
| `STAGING_URL` | Variable | Adresse publique de staging, affichée dans GitHub |
| `PRODUCTION_URL` | Variable | Adresse publique de la production, affichée dans GitHub |
| `STAGING_HEALTHCHECK_URL` | Variable, facultative | Adresse vérifiée après le déploiement. Par défaut, `STAGING_URL` |
| `PRODUCTION_HEALTHCHECK_URL` | Variable, facultative | Adresse vérifiée après le déploiement. Par défaut, `PRODUCTION_URL` |

Tant qu'un hook manque, le job passe au vert avec un avertissement « rien n'a été déployé ». Le résumé de l'exécution le dit aussi. La CD fonctionne donc dès maintenant : les vérifications de version et les releases tournent, et le déploiement s'active dès que le secret existe.

## 5. Comment un déploiement se fait

Le script [.github/scripts/deployer.sh](../.github/scripts/deployer.sh) fait deux choses :

1. Il envoie un `POST` au hook de l'environnement, avec ce corps :

   ```json
   { "environnement": "production", "version": "v0.1.0", "sha": "<commit>" }
   ```

2. Il interroge l'adresse de vérification toutes les 10 secondes, pendant 5 minutes au plus. Si elle ne répond pas, le job échoue et la release n'est pas publiée.

La plupart des hébergeurs proposent un hook de déploiement (une adresse secrète qui lance un déploiement). Si celui choisi n'en a pas, remplacer l'étape « Déployer » du job par l'action de l'hébergeur, sans changer le reste du workflow.

## 6. Ce qu'il reste à brancher

- **Hébergement** : [[à choisir avec l'équipe]]. Puis créer les secrets et les variables de la section 4.
- **Version déployée** : le hook doit déployer le commit indiqué par `sha`, pas « le dernier commit de `main` ». Sinon un tag peut envoyer en production autre chose que ce qu'il désigne. [[Vérifier avec l'hébergeur choisi.]]
- **Vérification** : elle contrôle que l'application répond, pas qu'elle tourne la nouvelle version. Une route qui renvoie la version déployée permettrait de le vérifier. [[À ajouter avec le back.]]
- **Build** : le dépôt n'a pas encore de code. Quand la pile technique est choisie, ajouter la construction (image Docker, fichiers du front) avant l'étape « Déployer ». Si front et back partent séparément, chacun aura ses tags (`api-v1.2.0`, `web-v0.4.0`) et son job, comme le prévoit [strategie-de-branches.md](strategie-de-branches.md).
