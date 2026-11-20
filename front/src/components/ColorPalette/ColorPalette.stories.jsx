import { useState } from 'react'
import { PALETTE } from '../../api/palette.js'
import { ColorPalette } from './ColorPalette.jsx'

// La palette affichée est la proposition provisoire de front/src/api/palette.js, pas une décision de l'équipe.
export const ParDefaut = () => {
  const [color, setColor] = useState(PALETTE[0].color)
  return <ColorPalette colors={PALETTE} value={color} onChange={setColor} />
}

export const Desactivee = () => <ColorPalette colors={PALETTE} value={PALETTE[2].color} onChange={() => {}} disabled />
