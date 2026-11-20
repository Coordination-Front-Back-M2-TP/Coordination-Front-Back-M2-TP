import { useContext } from 'react'
import { createPortal } from 'react-dom'
import { HudSlotContext } from './hud-slot.js'

// Range ses enfants dans un emplacement du HUD (main à gauche, side à droite), quand il existe.
// Les éléments s'y empilent sans se chevaucher.
export function HudPortal({ slot = 'main', children }) {
  const target = useContext(HudSlotContext)?.[slot]
  return target ? createPortal(children, target) : children
}
