// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { subscribeCanvas } from '../../api/canvas.js'
import { LiveCanvas } from './LiveCanvas.jsx'

vi.mock('../../api/canvas.js', () => ({ subscribeCanvas: vi.fn() }))

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.resetAllMocks() })

it('affiche le classement public puis reflète un changement reçu sur la toile', async () => {
  let onRanking
  vi.mocked(subscribeCanvas).mockImplementation((onChange, options) => {
    onRanking = options.onRanking
    onChange({ canvas: null, status: 'live' })
    return () => {}
  })
  vi.stubGlobal('fetch', vi.fn(async (url) => ({
    ok: true,
    json: async () => url.endsWith('rankings')
      ? { revision: 1, teams: [{ teamId: 'rouge', rank: 1, pixelCount: 1 }] }
      : { teams: [{ id: 'rouge', name: 'Rouge', color: '#D93A3A' }, { id: 'bleue', name: 'Bleue', color: '#2F6FDE' }] },
  })))
  render(<LiveCanvas />)
  await waitFor(() => expect(screen.getByText('Rouge').parentElement.textContent).toContain('1 pixel'))
  act(() => onRanking({ revision: 2, teams: [{ teamId: 'bleue', rank: 1, pixelCount: 1 }] }))
  expect(screen.getByText('Bleue').parentElement.textContent).toContain('1 pixel')
  expect(screen.queryByText('Rouge')).toBeNull()
})
