import { createContext } from 'react'

// Colonne du HUD fournie par App : l'élément DOM où ranger les messages de la toile.
// Vaut null hors de App (tests, stories) : les messages restent alors à leur place.
export const HudSlotContext = createContext(null)
