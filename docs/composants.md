# Documentation des composants front-end

Ce document présente l'outil de documentation des composants UI du front-end P1X3L, la comparaison ayant mené au choix technique, ainsi que le mode d'emploi pour visualiser et créer des stories.

---

## 1. Choix technique : Ladle vs Storybook

Pour documenter et tester visuellement les composants React en isolation, deux outils majeurs de l'écosystème ont été étudiés : **Storybook** et **Ladle**.

### Tableau comparatif

| Critère | Storybook | Ladle | Choix pour P1X3L |
| --- | --- | --- | --- |
| Intégration Vite | Nécessite un framework spécifique (`@storybook/react-vite`) et une configuration dédiée | Intégration native avec Vite, réutilise directement `vite.config.js` | **Ladle** |
| Temps de démarrage | Plusieurs secondes (lourd au lancement) | Instantané (< 100 ms) | **Ladle** |
| Poids des dépendances | Plusieurs dizaines de packages, ~100 Mo+ dans `node_modules` | Très léger (1 seul package `@ladle/react`) | **Ladle** |
| Compatibilité React 19 et Vite 8 | Historiquement plus complexe lors des montées de version majeures | Support fluide sans friction | **Ladle** |
| Format des stories | Component Story Format (CSF) | Component Story Format (CSF) standard compatible | Égalité |

### Décision validée

**Ladle** est retenu comme atelier de composants pour P1X3L. Sa rapidité d'exécution, son intégration native avec Vite 8 et son empreinte minimale dans la CI permettent de développer et tester nos composants sans alourdir le projet.

---

## 2. Commandes et accès

Toutes les commandes se lancent depuis la racine du dépôt :

| Action | Commande | Description |
| --- | --- | --- |
| Lancer l'atelier en local | `npm run ladle --prefix front` | Démarre le serveur Ladle sur `http://localhost:61000` |
| Construire la version statique | `npm run build:ladle --prefix front` | Génère les fichiers statiques de documentation dans `build/` |

---

## 3. Composants documentés

### `ServerStatus`

Le composant [`ServerStatus`](../front/src/components/ServerStatus/ServerStatus.jsx) affiche l'état de la connexion entre l'application React et l'API Express :

- Fichier source : `front/src/components/ServerStatus/ServerStatus.jsx`
- Fichier de stories : `front/src/components/ServerStatus/ServerStatus.stories.jsx`

#### États documentés

- **Connecté (`Connecte`)** : le serveur répond correctement (`status = "ok"`).
- **En cours de vérification (`EnVerification`)** : l'appel à `/api/health` est en cours (`status = "vérification…"`).
- **Injoignable (`Injoignable`)** : l'API ne répond pas ou est arrêtée (`status = "injoignable"`).

---

### `PixelCanvas`

Le composant [`PixelCanvas`](../front/src/components/PixelCanvas/PixelCanvas.jsx) affiche la toile publique avec les dimensions et les couleurs fournies par le serveur. Les cases vides sont sur un damier ; une liste textuelle donne les coordonnées et les couleurs au clavier. Le fichier `front/src/components/PixelCanvas/PixelCanvas.stories.jsx` présente une toile vide et une toile avec trois pixels. Les dimensions et couleurs des stories sont des exemples, pas une décision sur la résolution ou la palette du jeu.

`LiveCanvas` gère l’abonnement, les états de connexion et le bouton de reprise sur la page d’accueil. Le protocole et ses tests sont décrits dans [toile-front.md](toile-front.md).

### `ColorPalette` et `PixelPlacer`

[`ColorPalette`](../front/src/components/ColorPalette/ColorPalette.jsx) affiche les couleurs sous forme de boutons radio nommés : le choix se fait au clavier, et la couleur choisie est encadrée. [`PixelPlacer`](../front/src/components/PixelPlacer/PixelPlacer.jsx) réunit la palette, le clic de pose sur `PixelCanvas`, une saisie des coordonnées au clavier et l'annonce du résultat. Comme chaque composant, chacun a son dossier, avec ses styles, ses tests et ses stories. Le parcours est décrit dans [pose-front.md](pose-front.md).

## 4. Conventions pour ajouter un nouveau composant

- Créer le dossier du composant, `front/src/components/NomDuComposant/`, et le composant `NomDuComposant.jsx` dedans (nom en PascalCase conformément à [GUIDELINES.md](../GUIDELINES.md)).
- Créer dans le même dossier ses stories (`NomDuComposant.stories.jsx`), ses tests (`NomDuComposant.test.jsx`) et, s'il en a, ses styles (`NomDuComposant.module.css`).
- Exporter chaque variante sous forme de fonction nommée :

```jsx
import { NomDuComposant } from './NomDuComposant.jsx'

export const VarianteParDefaut = () => <NomDuComposant />
export const VarianteActive = () => <NomDuComposant actif={true} />
```

- Vérifier avec `npm run lint --prefix front` et `npm run build --prefix front` que tout compile sans avertissement.
