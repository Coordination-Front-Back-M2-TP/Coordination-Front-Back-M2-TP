// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthForm } from './AuthForm.jsx'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const json = (status, body) => ({ ok: status < 400, status, json: async () => body })

function fill(pseudo, password) {
  fireEvent.change(screen.getByLabelText('Pseudo'), { target: { value: pseudo } })
  fireEvent.change(screen.getByLabelText('Mot de passe'), { target: { value: password } })
}

describe('AuthForm', () => {
  it('connecte le joueur et transmet son pseudo', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(200, { user: { pseudo: 'sam' } }))
    vi.stubGlobal('fetch', fetchMock)
    const onAuthenticated = vi.fn()
    render(<AuthForm onAuthenticated={onAuthenticated} />)
    fill('sam', 'mot-de-passe')
    fireEvent.click(screen.getByRole('button', { name: 'Se connecter' }))
    await waitFor(() => expect(onAuthenticated).toHaveBeenCalledWith({ pseudo: 'sam' }))
    expect(fetchMock.mock.calls[0][0]).toBe('/api/auth/login')
  })

  it("s'inscrit sur un seul écran", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(201, { user: { pseudo: 'lea' } }))
    vi.stubGlobal('fetch', fetchMock)
    const onAuthenticated = vi.fn()
    render(<AuthForm onAuthenticated={onAuthenticated} />)
    fireEvent.click(screen.getByRole('button', { name: 'Créer un compte' }))
    fill('lea', 'mot-de-passe')
    fireEvent.click(screen.getByRole('button', { name: "S'inscrire" }))
    await waitFor(() => expect(onAuthenticated).toHaveBeenCalledWith({ pseudo: 'lea' }))
    expect(fetchMock.mock.calls[0][0]).toBe('/api/auth/register')
  })

  it('signale un pseudo déjà pris sans afficher le message du serveur', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      json(409, { error: { code: 'PSEUDO_TAKEN', message: 'detail interne' } })))
    render(<AuthForm onAuthenticated={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Créer un compte' }))
    fill('sam', 'mot-de-passe')
    fireEvent.click(screen.getByRole('button', { name: "S'inscrire" }))
    expect((await screen.findByRole('alert')).textContent).toBe('Ce pseudo est déjà pris.')
  })

  it.each([
    [400, 'INVALID_INPUT', /Utilisez un pseudo de 3 à 20 caractères/],
    [401, 'INVALID_CREDENTIALS', /Pseudo ou mot de passe incorrect/],
  ])('explique l’erreur %s renvoyée par le back', async (status, code, message) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(status, { error: { code } })))
    render(<AuthForm onAuthenticated={vi.fn()} />)
    fill('sam', 'mot-de-passe')
    fireEvent.click(screen.getByRole('button', { name: 'Se connecter' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(message)
  })

  it('affiche un message générique sur une erreur réseau', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('secret')))
    render(<AuthForm onAuthenticated={vi.fn()} />)
    fill('sam', 'x')
    fireEvent.click(screen.getByRole('button', { name: 'Se connecter' }))
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).not.toContain('secret')
  })
})
