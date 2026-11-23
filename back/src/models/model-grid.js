import { PALETTE_COLORS } from '../canvas/palette.js'
import { internalError } from '../errors/app-error.js'

const MAX_SIZE = 32
const TRANSPARENT = '.'
const SYMBOLS = '0123456789ABCDEF'
const PALETTE = new Map([...SYMBOLS].map((symbol, index) => [symbol, PALETTE_COLORS[index]]))

export const GRID_INSTRUCTIONS = [
  'Dessine un motif en pixel art qui répond à la consigne. Rends uniquement la grille, au format JSON demandé.',
  `Le tableau rows contient entre 1 et ${MAX_SIZE} lignes de même longueur, de 1 à ${MAX_SIZE} caractères.`,
  'La première ligne est en haut. La première colonne est à gauche.',
  `Chaque caractère code un pixel selon cette palette : ${[...PALETTE].map(([symbol, color]) => `${symbol}=${color}`).join(', ')}.`,
  `Le caractère ${TRANSPARENT} indique une case transparente. Mets au moins une case colorée.`,
].join(' ')

export function readModelGrid(grid) {
  const invalid = () => internalError('La génération a renvoyé une grille invalide.')
  const { rows } = grid ?? {}
  if (!Array.isArray(rows) || rows.length < 1 || rows.length > MAX_SIZE || typeof rows[0] !== 'string') throw invalid()
  const width = rows[0].length
  if (width < 1 || width > MAX_SIZE) throw invalid()

  const pixels = []
  for (const [y, row] of rows.entries()) {
    if (typeof row !== 'string' || row.length !== width) throw invalid()
    for (const [x, symbol] of [...row].entries()) {
      if (symbol === TRANSPARENT) continue
      const color = PALETTE.get(symbol)
      if (!color) throw invalid()
      pixels.push({ x, y, color })
    }
  }
  if (pixels.length === 0) throw invalid()
  return { width, height: rows.length, pixels }
}
