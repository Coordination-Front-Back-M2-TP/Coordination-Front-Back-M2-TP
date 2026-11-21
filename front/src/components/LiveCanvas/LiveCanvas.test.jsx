// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { subscribeCanvas } from '../../api/canvas.js'
import { parseCanvasSnapshot } from '../../api/canvas-state.js'
import { LiveCanvas } from './LiveCanvas.jsx'

vi.mock('../../api/canvas.js', () => ({ subscribeCanvas: vi.fn() }))
vi.mock('../Ranking/Ranking.jsx', () => ({ Ranking: () => null }))
let subscriptions
let stops
const canvas = () => parseCanvasSnapshot({ width: 3, height: 3, revision: 0, snapshotAt: '2026-10-27T14:30:00.000Z', pixels: [] })

beforeEach(() => {
  subscriptions = []
  stops = []
  vi.mocked(subscribeCanvas).mockImplementation((onChange) => {
    subscriptions.push(onChange)
    const stop = vi.fn()
    stops.push(stop)
    return stop
  })
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ clearRect() {}, fillRect() {} })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

it('annonce le chargement puis la toile publique en direct', () => {
  render(<LiveCanvas />)
  expect(screen.getByRole('status').textContent).toBe('Chargement de la toile…')
  act(() => subscriptions[0]({ canvas: canvas(), status: 'live' }))
  expect(screen.getByRole('status').textContent).toBe('Toile en direct')
  expect(screen.getByRole('img', { name: 'Toile partagée de 3 par 3 pixels' })).toBeTruthy()
})

it('conserve l’image en avertissant qu’elle peut être ancienne pendant la reconnexion', () => {
  render(<LiveCanvas />)
  const board = canvas()
  act(() => subscriptions[0]({ canvas: board, status: 'live' }))
  act(() => subscriptions[0]({ canvas: board, status: 'reconnecting' }))
  expect(screen.getByRole('status').textContent).toContain('Reconnexion en cours')
  expect(screen.getByText(/Dernier état reçu/)).toBeTruthy()
  expect(screen.getByRole('img')).toBeTruthy()
})

it('conserve la toile affichée avec un avertissement quand la synchronisation échoue', () => {
  render(<LiveCanvas />)
  const board = canvas()
  act(() => subscriptions[0]({ canvas: board, status: 'live' }))
  act(() => subscriptions[0]({ canvas: board, status: 'error' }))
  expect(screen.getByRole('alert').textContent).toContain('Impossible de synchroniser')
  expect(screen.getByText(/Dernier état reçu/)).toBeTruthy()
  expect(screen.getByRole('img')).toBeTruthy()
})

it('permet de réessayer et ferme le précédent abonnement', () => {
  const { unmount } = render(<LiveCanvas />)
  act(() => subscriptions[0]({ canvas: null, status: 'error' }))
  expect(screen.getByRole('alert').textContent).toContain('Impossible de synchroniser')
  fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }))
  expect(stops[0]).toHaveBeenCalledOnce()
  expect(subscriptions).toHaveLength(2)
  act(() => subscriptions[1]({ canvas: canvas(), status: 'live' }))
  expect(screen.queryByRole('alert')).toBeNull()
  unmount()
  expect(stops[1]).toHaveBeenCalledOnce()
})

it('réserve la modération des joueurs aux administrateurs', () => {
  const { rerender } = render(<LiveCanvas user={null} />)
  expect(screen.queryByText('Modérer les joueurs')).toBeNull()
  rerender(<LiveCanvas user={{ pseudo: 'Sam', role: 'player' }} />)
  expect(screen.queryByText('Modérer les joueurs')).toBeNull()
  rerender(<LiveCanvas user={{ pseudo: 'Lea', role: 'admin' }} />)
  expect(screen.getByText('Modérer les joueurs')).toBeTruthy()
})
