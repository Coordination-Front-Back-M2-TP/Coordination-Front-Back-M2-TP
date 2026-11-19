// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { parseCanvasSnapshot } from '../../api/canvas-state.js'
import { PixelCanvas } from './PixelCanvas.jsx'

const date = '2026-10-27T14:30:00.000Z'
const pixel = (x, y, color) => ({ x, y, color, revision: 1, updatedAt: date })
const canvas = (pixels) => parseCanvasSnapshot({ width: 3, height: 3, revision: 1, snapshotAt: date, pixels })
let draws

beforeEach(() => {
  draws = []
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    clearRect() { draws.length = 0 },
    fillRect(x, y, width, height) { draws.push({ x, y, width, height, color: this.fillStyle }) },
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

it('dessine les coordonnées négatives, le centre et la borne positive avec les couleurs serveur', () => {
  render(<PixelCanvas canvas={canvas([pixel(-1, -1, '#D93A3A'), pixel(0, 0, '#2563EB'), pixel(1, 1, '#22C55E')])} />)
  expect(draws).toEqual([
    { x: 0, y: 0, width: 1, height: 1, color: '#D93A3A' },
    { x: 1, y: 1, width: 1, height: 1, color: '#2563EB' },
    { x: 2, y: 2, width: 1, height: 1, color: '#22C55E' },
  ])
  expect(screen.getByRole('img').getAttribute('width')).toBe('3')
})

it('efface les pixels absents du nouvel instantané', () => {
  const { rerender } = render(<PixelCanvas canvas={canvas([pixel(0, 0, '#D93A3A')])} />)
  rerender(<PixelCanvas canvas={canvas([])} />)
  expect(draws).toEqual([])
  expect(screen.getByText(/Aucun pixel posé/)).toBeTruthy()
})

it('propose une alternative textuelle avec les coordonnées et les couleurs', async () => {
  render(<PixelCanvas canvas={canvas([pixel(-1, 1, '#D93A3A')])} />)
  const details = screen.getByText('Consulter les pixels en texte').closest('details')
  details.open = true
  fireEvent(details, new Event('toggle'))
  expect(await screen.findByText('(-1, 1) : #D93A3A')).toBeTruthy()
})

it('affiche directement les pixels en texte si le contexte graphique est indisponible', () => {
  vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(null)
  const { rerender } = render(<PixelCanvas canvas={canvas([pixel(-1, 1, '#D93A3A')])} />)
  expect(screen.getByRole('alert').textContent).toContain('affichage graphique est indisponible')
  expect(screen.getByText('(-1, 1) : #D93A3A')).toBeTruthy()
  rerender(<PixelCanvas canvas={canvas([pixel(0, 0, '#2563EB')])} />)
  expect(screen.getByText('(0, 0) : #2563EB')).toBeTruthy()
})
