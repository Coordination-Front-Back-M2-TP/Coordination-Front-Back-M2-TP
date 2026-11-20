// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { TeamCreation } from './TeamCreation.jsx'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

function fillForm(name = 'Les Éclairs') {
  fireEvent.change(screen.getByLabelText('Nom de l’équipe'), { target: { value: name } })
  fireEvent.change(screen.getByLabelText('Couleur de l’équipe'), { target: { value: '#9333EA' } })
}

it('crée une équipe de la palette et transmet le joueur mis à jour', async () => {
  const team = { id: 'les-eclairs', name: 'Les Éclairs', color: '#9333EA' }
  const user = { pseudo: 'sam', team }
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ team, user }) })
  vi.stubGlobal('fetch', fetchMock)
  const onCreated = vi.fn()
  render(<TeamCreation onCreated={onCreated} />)
  fillForm('  Les Éclairs  ')
  fireEvent.click(screen.getByRole('button', { name: 'Créer l’équipe' }))
  await waitFor(() => expect(onCreated).toHaveBeenCalledWith({ team, user }))
  expect(fetchMock).toHaveBeenCalledWith('/api/teams', expect.objectContaining({
    method: 'POST', credentials: 'same-origin', body: JSON.stringify({ name: 'Les Éclairs', color: '#9333EA' }),
  }))
})

it('refuse un nom invalide avant l’appel et affiche le conflit serveur', async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 409, json: async () => ({ error: { code: 'TEAM_NAME_TAKEN' } }) })
  vi.stubGlobal('fetch', fetchMock)
  render(<TeamCreation onCreated={vi.fn()} />)
  fillForm('!?')
  fireEvent.click(screen.getByRole('button', { name: 'Créer l’équipe' }))
  expect(screen.getByRole('alert').textContent).toContain('3 à 20')
  expect(fetchMock).not.toHaveBeenCalled()
  fillForm('Doublon')
  fireEvent.click(screen.getByRole('button', { name: 'Créer l’équipe' }))
  expect((await screen.findByRole('alert')).textContent).toContain('déjà pris')
})

it('annonce le délai imposé par le serveur', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: false, status: 429, headers: new Headers({ 'Retry-After': '30' }),
    json: async () => ({ error: { code: 'TEAM_CHANGE_COOLDOWN' } }),
  }))
  render(<TeamCreation onCreated={vi.fn()} />)
  fillForm()
  fireEvent.click(screen.getByRole('button', { name: 'Créer l’équipe' }))
  expect((await screen.findByRole('timer')).textContent).toContain('30 s')
  expect(screen.getByRole('button', { name: 'Créer l’équipe' }).disabled).toBe(true)
})

it('ignore une réponse tardive après démontage', async () => {
  let resolve
  vi.stubGlobal('fetch', vi.fn(() => new Promise((done) => { resolve = done })))
  const onCreated = vi.fn()
  const { unmount } = render(<TeamCreation onCreated={onCreated} />)
  fillForm()
  fireEvent.click(screen.getByRole('button', { name: 'Créer l’équipe' }))
  unmount()
  const team = { id: 'les-eclairs', name: 'Les Éclairs', color: '#9333EA' }
  resolve({ ok: true, json: async () => ({ team, user: { pseudo: 'sam', team } }) })
  await waitFor(() => expect(onCreated).not.toHaveBeenCalled())
})
