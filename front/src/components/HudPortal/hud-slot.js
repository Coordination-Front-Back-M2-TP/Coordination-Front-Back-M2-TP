import { createContext } from 'react'

// Emplacements du HUD fournis par App : main, la colonne de gauche sous le logo (état, zoom, pixels en texte) ;
// side, la colonne de droite sous le compte (classement). Vaut null hors de App (tests, stories) :
// les éléments restent alors à leur place.
export const HudSlotContext = createContext(null)
