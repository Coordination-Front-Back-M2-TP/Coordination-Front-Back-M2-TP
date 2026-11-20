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

### Design de base et HUD

Le design vient de la maquette A, choisie le 20/11/2026 ([docs/design/2026-11-20-maquettes/](design/2026-11-20-maquettes/README.md)) : la toile couvre tout l'écran, et le HUD flotte par-dessus.

- **Variables de design** : couleurs, polices, espacements, bords et ombre sont dans [`front/src/styles/tokens.css`](../front/src/styles/tokens.css). Les styles communs (boutons, champs, focus, carte `.hud`, classe `.visually-hidden`) sont dans [`front/src/styles/base.css`](../front/src/styles/base.css). Les deux sont chargés par `main.jsx`, et par `front/.ladle/components.jsx` pour les stories. Un composant utilise ces variables dans son `*.module.css`, sans couleur écrite en dur.
- **`HudPortal`** : [`HudPortal`](../front/src/components/HudPortal/HudPortal.jsx) range un élément dans un emplacement du HUD fourni par `App` : `main` à gauche sous le logo (état de la toile, zoom, pixels en texte), `side` à droite sous le compte (classement). Hors de `App` (tests, stories), l'élément reste à sa place.
- **Zoom et déplacement** : le hook [`useZoomPan`](../front/src/hooks/use-zoom-pan.js) gère la molette autour du curseur, le glisser à la souris ou au doigt, le pincement à deux doigts et les touches `+`, `-` et `0`. Le zoom va de 0,25 à 8 ; à 1, toute la toile tient à l'écran (« Vue d'ensemble »). Un glisser ne pose pas de pixel ; un clic sans déplacement en pose un.
- **Téléphone** (760 px de large ou moins) : une ligne en haut (logo, bouton Menu), le reste du HUD dans un panneau qui s'ouvre par-dessus la toile. Les alertes restent visibles menu fermé. Dans le dock, la saisie par coordonnées se replie derrière le bouton « Coordonnées ».

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
