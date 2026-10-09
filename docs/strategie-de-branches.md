# Stratégie de branches : analyse et notre flow

<!-- Analyse du 09/10/2026, à copier dans docs/ du dépôt du TP. Les [[…]] dépendent du sujet et de l'architecture, encore inconnus. -->

Git Flow est souvent appliqué par réflexe. Ce document part de notre contexte, compare les flows connus sur des critères explicites, puis décrit le flow que nous retenons, ce qu'il nous coûte et ce qui nous ferait changer d'avis.

## 1. Notre contexte

- Une équipe de [[3 ou 4]] personnes : [[un dev front, un dev back, un product owner]].
- Une application [[front et back, peut-être découpée en services]], dans [[un seul dépôt]].
- Du travail en sprints. Chaque ticket de l'outil de gestion de projet est relié à une branche et à une PR.
- Deux environnements : staging (pré-production) et production. [[Hébergement à préciser.]]
- Une seule version en production à la fois : personne n'a besoin de maintenir une ancienne version.
- Des numéros de version lisibles, au format semver.

## 2. Critères de choix

| Critère | Pourquoi il compte pour nous |
| --- | --- |
| C1. Simplicité | Peu de branches longues à retenir et à synchroniser. L'équipe découvre ce process. |
| C2. Intégration fréquente | Front et back avancent en parallèle. Plus on intègre tard, plus les conflits et les surprises d'API coûtent cher. |
| C3. Environnements | Passer de staging à production sans que les deux divergent. |
| C4. Versions | Savoir ce qui tourne en production, avec un numéro semver. |
| C5. Services indépendants | Si l'application se découpe en microservices, chacun doit pouvoir partir en production seul. |
| C6. Outillage GitHub | `Closes #` ne ferme une issue que sur la branche par défaut. Protections et CI doivent rester simples. |
| C7. Correctif urgent | Corriger la production sans embarquer du travail pas prêt. |

## 3. Les flows étudiés

- **Git Flow** ([Driessen, 2010](https://nvie.com/posts/a-successful-git-branching-model/)) : `main` et `develop` permanentes, plus des branches `feature`, `release` et `hotfix`. Il vise un logiciel versionné, avec plusieurs versions en circulation. Dans une note de 2020, l'auteur conseille un flow plus simple aux équipes en livraison continue. Fowler constate qu'il devient plus compliqué que nécessaire pour une application web qui n'a qu'une production ([2020](https://martinfowler.com/articles/branching-patterns.html)).
- **GitHub flow** ([docs GitHub](https://docs.github.com/en/get-started/using-github/github-flow)) : `main` et des branches de travail fusionnées par PR. Il suppose une seule version en production et une intégration fréquente. Il ne dit rien des environnements ni des numéros de version.
- **GitLab Flow** ([GitLab](https://about.gitlab.com/topics/version-control/what-is-gitlab-flow/)) : le GitHub flow, plus des branches d'environnement (pré-production, production) où le code descend depuis `main`. Fowler classe la branche d'environnement comme un anti-pattern : les différences entre environnements doivent vivre dans la configuration, pas dans des branches.
- **Trunk-based development** ([trunkbaseddevelopment.com](https://trunkbaseddevelopment.com/)) : une branche principale, et des branches de travail d'une personne qui durent deux jours au plus ([règles](https://trunkbaseddevelopment.com/short-lived-feature-branches/)). Les versions sont taguées sur le tronc. Une branche de release n'est créée qu'en cas de besoin : le correctif est fait sur le tronc, puis reporté par cherry-pick ([release](https://trunkbaseddevelopment.com/branch-for-release/)). La recherche DORA associe l'intégration au moins quotidienne, trois branches actives au plus et l'absence de gel du code à de meilleures performances de livraison ([DORA](https://dora.dev/capabilities/trunk-based-development/)).
- **Release Flow** ([Microsoft](https://learn.microsoft.com/en-us/azure/devops/repos/git/git-branching-guidance)) : des branches de travail fusionnées par PR dans `main`, et une branche `release/N` à la fin d'un sprint. Le correctif est fait dans `main`, puis porté. En déploiement continu, Microsoft promeut les builds de `main` vers les environnements plutôt que d'entretenir des branches de déploiement.
- **Ship / Show / Ask** ([Wilsenach, 2021](https://martinfowler.com/articles/ship-show-ask.html)) : ce n'est pas un flow de branches, mais une règle de relecture. Chaque changement est soit poussé directement (Ship), soit montré en PR mergée sans attendre (Show), soit soumis à relecture (Ask).

## 4. Comparaison

Notre évaluation, pour notre contexte : `+` répond bien, `~` en partie, `-` mal.

| Flow | C1 | C2 | C3 | C4 | C5 | C6 | C7 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Git Flow | - | - | ~ | + | - | - | + |
| GitHub flow | + | + | - | - | ~ | + | ~ |
| GitLab Flow | ~ | + | ~ | ~ | ~ | + | ~ |
| Trunk-based | + | + | + | + | + | + | + |
| Release Flow | ~ | + | ~ | + | ~ | + | + |

- **Git Flow** perd sur l'essentiel pour nous. Il impose deux branches longues et intègre tard (`develop`, puis `release`). Ses versions sont synchronisées, alors que des microservices partent en production chacun de leur côté. Et il faut faire de `develop` la branche par défaut pour que `Closes #` fonctionne.
- **Une branche `staging`** règle C3 en apparence seulement. Elle dérive de `main` et oblige à des fusions dans les deux sens. Staging est un environnement, pas une branche.
- **Trunk-based** répond à tous nos critères, à condition de tenir sa discipline : petites PR, CI rapide, relecture rapide. Notre flow le reprend et l'adapte.

## 5. Notre flow : tronc unique, branches courtes, promotion par tags

```text
feat/12-connexion       o---o
                       /     \    PR + CI + relecture, squash
main    ---o----------o-------o-------------o-------o--->
                              |  v0.1.0      \     /  v0.1.1
                              |               o---o   fix/15-date
staging <- chaque merge sur main est déployé en staging
prod    <- seul un tag vX.Y.Z validé en staging part en production
```

1. **Une seule branche longue : `main`.** Elle reste toujours déployable. Elle est protégée : PR obligatoire, CI verte, une relecture. C'est la branche par défaut, donc `Closes #` ferme le ticket au merge.
2. **Une branche courte par ticket** (`type/numéro-sujet`), partie de `main`, tenue par une personne, deux jours au plus. Si ça dépasse, le ticket est trop gros : on le découpe dans l'outil de gestion de projet. Le flow et le découpage en tickets se tiennent l'un l'autre.
3. **Merge en squash** dans `main`, puis suppression de la branche. Un ticket donne un commit lisible dans l'historique.
4. **Le travail pas fini ne reste pas dans une branche.** Il part dans `main` caché derrière un flag de configuration, ou en branchant l'interface en dernier ([feature toggles](https://martinfowler.com/articles/feature-toggles.html)).
5. **Staging est un environnement, pas une branche.** Chaque merge sur `main` y est déployé automatiquement. [[À brancher quand l'hébergement existe.]]
6. **La production reçoit un tag.** On tague `vX.Y.Z` un commit de `main` déjà validé en staging. Le tag déclenche le déploiement et la release GitHub. Le numéro suit semver, guidé par le type des commits (`feat`, `fix`, `!`).
7. **Correctif urgent : d'abord sur `main`.** On ouvre une PR `fix/…` sur `main`. Si `main` est publiable, on pose un nouveau tag CORRECTIF. Sinon, on crée `release/X.Y` à partir du dernier tag, on y reporte le correctif par cherry-pick, et on tague depuis cette branche. Elle est supprimée quand la version quitte la production.
8. **Le contrat entre front et back a sa propre PR.** Le contrat d'API ([[`contrat/openapi.yaml`]]) change dans une PR relue par une personne front et une personne back. Un changement cassant se fait en plusieurs temps : on ajoute le nouveau, on migre le front, puis on retire l'ancien ([parallel change](https://martinfowler.com/bliki/ParallelChange.html)). Ainsi front et back partent en production chacun à leur rythme.
9. **Des microservices, si l'architecture en a.** Un microservice doit pouvoir être déployé seul ([Lewis et Fowler, 2014](https://martinfowler.com/articles/microservices.html)). Chaque service a donc sa CI, filtrée sur son dossier, et ses propres tags (`api-v1.2.0`, `web-v0.4.0`). Tant que tout part ensemble, un seul numéro de version suffit.
10. **La relecture.** Nous avons écarté Ship / Show / Ask pour l'instant : l'article lui-même conseille plutôt Show et Ask à une équipe qui se découvre, et nos PR servent aussi de trace pour les tickets. Chaque PR demande donc une relecture (Ask). En échange, les PR restent petites, et la relecture se fait dans la demi-journée pour ne pas bloquer le tronc. DORA cite la relecture lente comme un piège du trunk-based.

## 6. Ce que ce flow nous coûte

- De la discipline : petites PR, tests et CI qui tournent en quelques minutes.
- Des flags à retirer une fois la fonctionnalité terminée.
- Des relectures rapides, sinon le tronc stagne.
- Une étape de tag pour chaque mise en production, à automatiser si possible.

## 7. Quand revoir ce choix

- S'il faut maintenir plusieurs versions en production : des branches de release (Release Flow), voire Git Flow, redeviennent pertinentes.
- Si les branches vivent en moyenne plus de deux jours, ou si les conflits se multiplient.
- Si la CI dépasse quelques minutes.
- À chaque rétrospective de sprint, en regardant ces trois signaux.

## Sources

Consultées le 9 octobre 2026.

- Vincent Driessen, [A successful Git branching model](https://nvie.com/posts/a-successful-git-branching-model/), 2010, note de 2020.
- Martin Fowler, [Patterns for Managing Source Code Branches](https://martinfowler.com/articles/branching-patterns.html), 28 mai 2020.
- GitHub, [GitHub flow](https://docs.github.com/en/get-started/using-github/github-flow) et [Lier une PR à une issue](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/linking-a-pull-request-to-an-issue).
- GitLab, [What is GitLab Flow](https://about.gitlab.com/topics/version-control/what-is-gitlab-flow/).
- Paul Hammant et contributeurs, [trunkbaseddevelopment.com](https://trunkbaseddevelopment.com/).
- DORA, [Trunk-based development](https://dora.dev/capabilities/trunk-based-development/).
- Microsoft, [Git branching guidance](https://learn.microsoft.com/en-us/azure/devops/repos/git/git-branching-guidance), mise à jour du 7 mai 2026.
- Rouan Wilsenach, [Ship / Show / Ask](https://martinfowler.com/articles/ship-show-ask.html), 8 septembre 2021.
- Pete Hodgson, [Feature Toggles](https://martinfowler.com/articles/feature-toggles.html).
- Danilo Sato, [Parallel Change](https://martinfowler.com/bliki/ParallelChange.html).
- James Lewis et Martin Fowler, [Microservices](https://martinfowler.com/articles/microservices.html), 25 mars 2014.
- [Semantic Versioning 2.0.0](https://semver.org/lang/fr/).
