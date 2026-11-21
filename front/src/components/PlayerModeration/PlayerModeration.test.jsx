// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { PlayerModeration } from './PlayerModeration.jsx'

const player = (pseudo, role = 'player', banned = false) => ({ pseudo, role, banned })
const page = (players, nextCursor = null) => Response.json({ players, nextCursor })

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

it('parcourt la liste et demande confirmation avant de bannir un joueur', async () => {
  const fetch = vi.fn()
    .mockResolvedValueOnce(page([player('Alice'), player('Léa', 'admin'), player('Sam', 'player', true)], 'Sam'))
    .mockResolvedValueOnce(page([player('Zoé')]))
    .mockResolvedValueOnce(Response.json({
      action: { id: 8, type: 'player_ban', details: { restoredCount: 2, clearedCount: 1 } },
    }))
  vi.stubGlobal('fetch', fetch)
  render(<PlayerModeration />)
  expect(fetch).not.toHaveBeenCalled()
  fireEvent.click(screen.getByText('Modérer les joueurs'))
  await screen.findByRole('button', { name: 'Bannir Alice' })
  expect(screen.queryByRole('button', { name: 'Bannir Léa' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Bannir Sam' })).toBeNull()

  fireEvent.click(screen.getByRole('button', { name: 'Charger la suite' }))
  const ban = await screen.findByRole('button', { name: 'Bannir Zoé' })
  expect(fetch.mock.calls[1][0]).toBe('/api/moderation/players?after=Sam')
  expect(screen.getByRole('button', { name: 'Bannir Alice' })).toBeTruthy()
  fireEvent.click(ban)
  fireEvent.click(screen.getByRole('button', { name: 'Annuler' }))
  expect(fetch).toHaveBeenCalledTimes(2)

  fireEvent.click(ban)
  fireEvent.click(screen.getByRole('button', { name: 'Confirmer le bannissement' }))
  expect(await screen.findByText(/Action n° 8 inscrite au journal/)).toBeTruthy()
  const [path, options] = fetch.mock.calls[2]
  expect(path).toBe('/api/moderation/bans')
  expect(options.method).toBe('POST')
  expect(JSON.parse(options.body)).toEqual({ pseudo: 'Zoé' })
  const row = screen.getByText('Zoé', { exact: false, selector: 'li' })
  expect(within(row).getByText('· Banni')).toBeTruthy()
  expect(within(row).queryByRole('button')).toBeNull()
})

it('actualise le statut quand un autre admin a déjà banni le joueur', async () => {
  const fetch = vi.fn()
    .mockResolvedValueOnce(page([player('Sam')]))
    .mockResolvedValueOnce(Response.json({ error: { code: 'ALREADY_BANNED', message: 'Détail serveur' } }, { status: 409 }))
  vi.stubGlobal('fetch', fetch)
  render(<PlayerModeration />)
  fireEvent.click(screen.getByText('Modérer les joueurs'))
  fireEvent.click(await screen.findByRole('button', { name: 'Bannir Sam' }))
  fireEvent.click(screen.getByRole('button', { name: 'Confirmer le bannissement' }))
  expect((await screen.findByRole('alert')).textContent).toBe('Ce joueur est déjà banni.')
  expect(screen.queryByRole('button', { name: 'Bannir Sam' })).toBeNull()
  expect(screen.getByText('· Banni')).toBeTruthy()
})
