// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { TeamPicker } from './TeamPicker.jsx'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

it('permet de retrouver une équipe créée pendant que la page est ouverte', async () => {
  const red = { id: 'rouge', name: 'Rouge' }
  const pink = { id: 'rose', name: 'Rose' }
  const response = (teams) => ({ ok: true, json: async () => ({ teams }) })
  const fetchMock = vi.fn().mockResolvedValueOnce(response([red])).mockResolvedValueOnce(response([red, pink]))
  vi.stubGlobal('fetch', fetchMock)
  render(<TeamPicker currentTeam={red} onTeamJoined={vi.fn()} />)
  expect(await screen.findByRole('option', { name: 'Rouge (équipe actuelle)' })).toBeTruthy()
  expect(screen.queryByRole('option', { name: 'Rose' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Actualiser les équipes' }))
  await waitFor(() => expect(screen.getByRole('option', { name: 'Rose' })).toBeTruthy())
  expect(fetchMock).toHaveBeenCalledTimes(2)
})
