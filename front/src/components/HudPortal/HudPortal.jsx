import { useContext } from 'react'
import { createPortal } from 'react-dom'
import { HudSlotContext } from './hud-slot.js'

// Range ses enfants dans la colonne du HUD, sous le logo, quand elle existe.
// Les messages de la toile (état, erreur, pixels en texte) s'y empilent sans se chevaucher.
export function HudPortal({ children }) {
  const slot = useContext(HudSlotContext)
  return slot ? createPortal(children, slot) : children
}
