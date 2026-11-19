// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { parseCanvasSnapshot } from '../../api/canvas-state.js'
import { PlacePixelError, placePixel } from '../../api/pixels.js'
import { PixelPlacer } from './PixelPlacer.jsx'

vi.mock('../../api/pixels.js', async (importOriginal) => ({ ...(await importOriginal()), placePixel: vi.fn() }))

const date = '2026-10-27T14:30:00.000Z'
const canvas = parseCanvasSnapshot({ width: 101, height: 101, revision: 0, snapshotAt: date, pixels: [] })
const saved = (x, y, color) => ({ pixel: { x, y, color, updatedAt: date, revision: 1 }, cooldownEndsAt: '2026-10-27T14:30:10.000Z' })

// jsdom ne calcule pas la mise en page : on donne à la toile une taille affichée de 404 × 404 (4 px par case).
function layOut(element) {
  element.getBoundingClientRect = () => ({ left: 10, top: 20, width: 404, height: 404 })
  Object.defineProperty(element, 'clientWidth', { value: 404 })
  Object.defineProperty(element, 'clientHeight', { value: 404 })
}

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ clearRect() {}, fillRect() {} })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.mocked(placePixel).mockReset()
})

it('pose la couleur choisie sur la case cliquée et annonce le succès', async () => {
  vi.mocked(placePixel).mockResolvedValue(saved(1, -1, '#2563EB'))
  render(<PixelPlacer canvas={canvas} user={{ pseudo: 'sam' }} />)
  fireEvent.click(screen.getByRole('radio', { name: 'Bleu' }))
  const board = screen.getByRole('img')
  layOut(board)
  // Case (51, 49) depuis le coin : x = 51 - 50 = 1, y = 49 - 50 = -1.
  await act(async () => fireEvent.click(board, { clientX: 10 + 51 * 4 + 2, clientY: 20 + 49 * 4 + 2 }))
  expect(placePixel).toHaveBeenCalledWith({ x: 1, y: -1, color: '#2563EB' }, expect.any(AbortSignal))
  expect(await screen.findByText('Pixel bleu posé en (1, -1).')).toBeTruthy()
})

it('vise les coins de la toile, origine au centre', async () => {
  vi.mocked(placePixel).mockResolvedValue(saved(-50, -50, '#000000'))
  render(<PixelPlacer canvas={canvas} />)
  const board = screen.getByRole('img')
  layOut(board)
  await act(async () => fireEvent.click(board, { clientX: 10, clientY: 20 }))
  expect(placePixel).toHaveBeenLastCalledWith({ x: -50, y: -50, color: '#000000' }, expect.any(AbortSignal))
  await act(async () => fireEvent.click(board, { clientX: 10 + 403, clientY: 20 + 403 }))
  expect(placePixel).toHaveBeenLastCalledWith({ x: 50, y: 50, color: '#000000' }, expect.any(AbortSignal))
})

it('n’envoie qu’une pose à la fois', async () => {
  let resolve
  vi.mocked(placePixel).mockReturnValue(new Promise((done) => { resolve = done }))
  render(<PixelPlacer canvas={canvas} user={{ pseudo: 'sam' }} />)
  const board = screen.getByRole('img')
  layOut(board)
  fireEvent.click(board, { clientX: 100, clientY: 100 })
  fireEvent.click(board, { clientX: 100, clientY: 100 })
  expect(placePixel).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('button', { name: 'Pose en cours…' }).disabled).toBe(true)
  await act(async () => resolve(saved(0, 0, '#000000')))
  expect(screen.getByRole('button', { name: 'Poser le pixel' }).disabled).toBe(false)
})

it('permet de poser au clavier par les coordonnées', async () => {
  vi.mocked(placePixel).mockResolvedValue(saved(-3, 7, '#22C55E'))
  render(<PixelPlacer canvas={canvas} user={{ pseudo: 'sam' }} />)
  fireEvent.click(screen.getByRole('radio', { name: 'Vert' }))
  fireEvent.change(screen.getByLabelText('Colonne (x)'), { target: { value: '-3' } })
  fireEvent.change(screen.getByLabelText('Ligne (y)'), { target: { value: '7' } })
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Poser le pixel' })))
  expect(placePixel).toHaveBeenCalledWith({ x: -3, y: 7, color: '#22C55E' }, expect.any(AbortSignal))
})

it('refuse des coordonnées hors de la toile sans appeler le serveur', () => {
  render(<PixelPlacer canvas={canvas} user={{ pseudo: 'sam' }} />)
  fireEvent.change(screen.getByLabelText('Colonne (x)'), { target: { value: '51' } })
  fireEvent.submit(screen.getByRole('form', { name: 'Poser un pixel par ses coordonnées' }))
  expect(placePixel).not.toHaveBeenCalled()
  expect(screen.getByText('Choisissez x entre -50 et 50, et y entre -50 et 50.')).toBeTruthy()
})

it('sans compte, n’affiche ni palette ni pose, et la toile reste visible', () => {
  render(<PixelPlacer canvas={canvas} user={null} />)
  expect(screen.getByText('Connectez-vous pour poser un pixel.')).toBeTruthy()
  expect(screen.queryByRole('radio')).toBeNull()
  fireEvent.click(screen.getByRole('img'))
  expect(placePixel).not.toHaveBeenCalled()
})

it('affiche un message fixe pour chaque refus du serveur', async () => {
  render(<PixelPlacer canvas={canvas} />)
  const submit = () => act(async () => fireEvent.click(screen.getByRole('button', { name: 'Poser le pixel' })))
  const cases = [
    [new PlacePixelError('UNAUTHORIZED'), 'Connectez-vous pour poser un pixel.'],
    [new PlacePixelError('COOLDOWN_ACTIVE', { retryAfterSeconds: 7 }), 'Attendez encore 7 secondes avant de poser un autre pixel.'],
    [new PlacePixelError('INVALID_INPUT'), 'Cette case ou cette couleur n’est pas acceptée.'],
    [new PlacePixelError('INTERNAL_SERVER_ERROR'), 'La pose a échoué. Réessayez dans un instant.'],
  ]
  for (const [error, message] of cases) {
    vi.mocked(placePixel).mockRejectedValueOnce(error)
    await submit()
    expect(screen.getByText(message)).toBeTruthy()
  }
})
