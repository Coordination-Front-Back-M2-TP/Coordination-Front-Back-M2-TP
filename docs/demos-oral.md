# Démos de l'oral « Road to PROD & Beyond »

Scénarios prêts à jouer pour l'oral : chaque commande a été lancée en local avant d'être écrite ici. Les commandes sont en PowerShell, depuis la racine du dépôt, dépendances installées ([INSTALL.md](../INSTALL.md), section 4).

## 1. Migration BDD : ajouter une colonne et mettre à jour les données existantes

**Ce qu'on montre** : chaque pixel visible garde l'équipe qui l'a posé. On ajoute la colonne `teamId` à `Pixel`, puis on la remplit pour les pixels déjà posés à partir de l'historique `PixelPlacement` : la pose qui a la même révision que le pixel est la dernière, donc celle qui compte.

La démo travaille sur une base à part, `back/prisma/demo.db` (ignorée par Git) : la base de développement n'est pas touchée.

### Préparer (avant l'oral)

```powershell
cd back
$env:DATABASE_URL = "file:./prisma/demo.db"
npm run db:migrate:deploy
npx prisma db execute --file ../docs/demos/seed-migration.sql
node scripts/afficher-pixels.js
```

Le tableau montre deux pixels, sans colonne `teamId`. Le pixel (10, 10) a été posé par l'équipe rouge, puis repris par l'équipe bleue ([seed-migration.sql](demos/seed-migration.sql)).

### Jouer (devant le jury)

1. Dans `back/prisma/schema.prisma`, ajouter au modèle `Pixel` la ligne `teamId    String?`. La colonne est facultative : les lignes existantes n'ont pas encore de valeur.
2. Générer la migration sans l'appliquer, pour pouvoir la relire et la compléter :

   ```powershell
   npm run db:migrate:dev -- --create-only --name ajouter_equipe_pixel
   ```

3. Ouvrir `back/prisma/migrations/<date>_ajouter_equipe_pixel/migration.sql`. Prisma a écrit `ALTER TABLE "Pixel" ADD COLUMN "teamId" TEXT;`. Ajouter à la fin la mise à jour des données existantes :

   ```sql
   -- Données existantes : l'équipe d'un pixel visible est celle de la pose qui a la même révision.
   UPDATE "Pixel" SET "teamId" = (
       SELECT "teamId" FROM "PixelPlacement" WHERE "PixelPlacement"."revision" = "Pixel"."revision"
   );
   ```

4. Appliquer, puis montrer le résultat :

   ```powershell
   npm run db:migrate:dev
   node scripts/afficher-pixels.js
   ```

   Résultat attendu : (10, 10) a `teamId = bleu` (la dernière pose), (11, 10) a `teamId = rouge`.

### Ce qu'on explique

- **Dev et prod** : `migrate dev` crée et applique les migrations en développement. En production, le back lance `migrate deploy` à son démarrage (`npm start`, `back/package.json`) : il applique les migrations versionnées, sans en créer.
- **Les migrations sont versionnées dans Git** et relues en PR comme du code : tout le monde a le même schéma, dans le même ordre.
- **Sans coupure** : une colonne facultative, puis le remplissage des données. L'ancienne version du code continue de marcher pendant la mise à jour. On ne la rend obligatoire que dans une migration suivante, une fois que le code l'écrit partout.
- **Sécurité** : sauvegarder le volume `canvas-data` avant une migration en production ([deploiement.md](deploiement.md), section 6).
- **Relire le SQL généré** : à ce jour, Prisma ajoute aussi une réécriture de la table `CanvasState`. La première migration n'a pas le `DEFAULT 1` que déclare le schéma. Cette réécriture recopie les données, elle est sans danger, mais elle montre pourquoi on relit toujours le SQL avant de l'appliquer. Prisma ajoute aussi deux lignes de commentaire en tête de `migration_lock.toml`.

### En production (à préparer avant l'oral)

L'app est déjà déployée sur le NAS : le jury attendra aussi de voir comment une migration arrive en production. La démo locale montre la création de la migration ; la mise en production se fait **avant** l'oral, parce que le NAS met jusqu'à 10 minutes à prendre une nouvelle version ([deploiement.md](deploiement.md), section 2).

Chemin d'une migration jusqu'à la production :

1. PR avec la migration et le code qui l'utilise, CI verte, relecture, merge.
2. Images publiées en staging, puis tag `vX.Y.Z` : images de production.
3. Le NAS tire la nouvelle image et relance le back.
4. Au démarrage, le back lance `migrate deploy` (`npm start`) avant d'écouter : la migration s'applique à la base de production.
5. Le healthcheck du back passe, le front (`depends_on: service_healthy`) suit.

Ce qui reste à faire pour une vraie migration de prod :

- [ ] Après le merge de #126 (délai côté serveur), qui modifie `savePixel` : ouvrir une issue pour enregistrer l'équipe du pixel visible. Migration `teamId` ci-dessus, plus l'écriture de `teamId` dans `savePixel`, sinon les nouveaux pixels auraient une équipe vide. Utile au classement des équipes (#28) et au persona gamification.
- [ ] Sauvegarder le volume `canvas-data`, puis livrer avec un tag.
- [ ] Garder pour l'oral les logs du back sur le NAS (ligne `Applying migration`) et les données avant et après.
- [ ] Compléter la section 3 de [deploiement.md](deploiement.md) : une colonne facultative laisse l'ancienne version marcher, donc le retour arrière reste possible sans annuler la migration.

### Remettre à zéro (après une répétition)

```powershell
git checkout -- prisma/schema.prisma prisma/migrations/migration_lock.toml
Remove-Item -Recurse prisma/migrations/*_ajouter_equipe_pixel
Remove-Item prisma/demo.db
npm run db:generate
Remove-Item Env:DATABASE_URL
```

## 2. Conflit de code : deux features sur le même fichier

**Ce qu'on montre** : deux développeurs changent la même ligne, le message de la 404 de l'API dans `back/src/middleware/error-handler.js`. La première branche est fusionnée, la seconde entre en conflit au rebase, et on le résout.

La démo se joue dans un clone à part, pour ne pas toucher au `main` local de son poste.

### Préparer

```powershell
git clone git@github.com:Coordination-Front-Back-M2-TP/Coordination-Front-Back-M2-TP.git demo-conflit
cd demo-conflit
npm ci --prefix back
git switch -c demo/conflit-a
```

Dans `back/src/middleware/error-handler.js`, remplacer `'Route introuvable.'` par `'Cette route n’existe pas.'`, puis :

```powershell
git commit -am "feat(back): reformuler le message 404"
git switch main
git switch -c demo/conflit-b
```

Sur la même ligne, remplacer cette fois `'Route introuvable.'` par `` `Route introuvable : ${req.method} ${req.path}` ``, puis :

```powershell
git commit -am "feat(back): préciser la route dans le message 404"
git switch main
git merge demo/conflit-a
```

`main` contient maintenant la première feature, comme après le merge de sa PR.

### Jouer

```powershell
git switch demo/conflit-b
git rebase main
```

Git s'arrête sur `CONFLICT (content)` dans `error-handler.js`. Ouvrir le fichier dans VS Code et montrer les deux versions entre `<<<<<<<` et `>>>>>>>`. Garder la version de `main`, `'Cette route n’existe pas.'` : la seconde renvoie l'adresse demandée dans la réponse, ce que la politique de sécurité interdit ([erreurs.md](erreurs.md), section 4). Résoudre un conflit, c'est choisir avec une règle, pas seulement retirer les marqueurs. Puis :

```powershell
git add back/src/middleware/error-handler.js
git rebase --continue
npm test --prefix back
```

Les tests à relancer après la résolution montrent qu'on vérifie le résultat, pas seulement l'absence de marqueurs. En vrai, la PR repasse aussi par la CI et par une relecture.

### Ce qu'on explique

- **Prévenir plutôt que résoudre** : branches courtes (deux jours au plus), une issue par sujet, rebase fréquent sur `main` ([strategie-de-branches.md](strategie-de-branches.md)). Moins une branche vit, moins elle diverge.
- **Rebase plutôt que merge** dans sa branche : l'historique reste linéaire et le squash à la fusion donne un commit par PR.
- **Le contrat avant le code** : le front et le back se mettent d'accord sur les routes et les erreurs ([contrat-erreurs.md](contrat-erreurs.md)) avant de coder. Ça évite les conflits de sens, que Git ne détecte pas.
- **Sécurité** : une adresse peut contenir un jeton ou une donnée personnelle. La renvoyer dans une erreur, c'est risquer de l'afficher ou de la journaliser. C'est le genre de point qu'on vérifie en relecture.

### Nettoyer

Supprimer le dossier `demo-conflit`. Rien n'a été poussé.
