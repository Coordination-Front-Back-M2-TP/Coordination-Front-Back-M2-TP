// @vitest-environment jsdom
import { StrictMode } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App.jsx'
import { parseCanvasSnapshot } from './api/canvas-state.js'
import { subscribeCanvas } from './api/canvas.js'

vi.mock('./api/canvas.js', () => ({ subscribeCanvas: vi.fn(() => () => {}) }))

const healthyResponse = () => ({ ok: true, json: async () => ({ status: 'ok', version: 'dev' }) })

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('état de connexion', () => {
  it('affiche une vérification en cours tant que le serveur ne répond pas', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
    render(<App />)
    expect(screen.getByText(/^Back :/).textContent).toBe('Back : vérification…')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('affiche la connexion lorsque le serveur répond correctement', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url) => url === '/api/auth/me'
      ? { ok: false, status: 401 }
      : healthyResponse()))
    render(<App />)
    await waitFor(() => expect(screen.getByText(/^Back :/).textContent).toBe('Back : ok'))
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it.each([
    ['une erreur HTTP', () => Promise.resolve({
      ok: false,
      status: 500,
      statusText: 'secret',
      json: async () => ({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'secret' } }),
    })],
    ['une erreur réseau', () => Promise.reject(new TypeError('secret'))],
    ['un JSON illisible', () => Promise.resolve({ ok: true, json: async () => { throw new SyntaxError('secret') } })],
    ['un état invalide', () => Promise.resolve({ ok: true, json: async () => ({ status: 'secret' }) })],
    ['un état absent', () => Promise.resolve({ ok: true, json: async () => ({ version: 'secret' }) })],
    ['un corps nul', () => Promise.resolve({ ok: true, json: async () => null })],
    ['un corps de type incorrect', () => Promise.resolve({ ok: true, json: async () => 'secret' })],
    ['une interruption sans démontage', () => Promise.reject(new DOMException('secret', 'AbortError'))],
  ])('affiche un message compréhensible sans détail interne après %s', async (_case, response) => {
    vi.stubGlobal('fetch', vi.fn((url) => url === '/api/auth/me'
      ? Promise.resolve({ ok: false, status: 401 })
      : response()))
    render(<App />)
    await waitFor(() => expect(screen.getByText(/^Back :/).textContent).toBe('Back : injoignable'))
    expect(screen.getByRole('alert').textContent).toContain('Rechargez la page pour réessayer')
    expect(document.body.textContent).not.toContain('secret')
  })

  it.each([
    ['une ancienne réussite', healthyResponse, () => ({ ok: false }), 'injoignable'],
    ['un ancien échec', () => ({ ok: false }), healthyResponse, 'ok'],
  ])('ignore %s après le redémarrage de l’effet en StrictMode', async (_case, staleResponse, currentResponse, status) => {
    const pending = []
    // Seules les requêtes de santé sont suivies ; la requête de session reste en attente.
    vi.stubGlobal('fetch', vi.fn((url, { signal }) => new Promise((resolve) => {
      if (url === '/api/health') pending.push({ signal, resolve })
    })))

    const { unmount } = render(<StrictMode><App /></StrictMode>)
    expect(pending).toHaveLength(2)
    expect(pending[0].signal.aborted).toBe(true)

    await act(async () => pending[1].resolve(currentResponse()))
    await waitFor(() => expect(screen.getByText(/^Back :/).textContent).toBe(`Back : ${status}`))
    await act(async () => pending[0].resolve(staleResponse()))
    expect(screen.getByText(/^Back :/).textContent).toBe(`Back : ${status}`)

    unmount()
    expect(pending[1].signal.aborted).toBe(true)
  })
})

describe('session du joueur', () => {
  const route = (me) => vi.fn((url) => Promise.resolve(
    url === '/api/auth/me' ? me : healthyResponse()))

  it('retrouve le joueur connecté au rechargement', async () => {
    vi.stubGlobal('fetch', route({ ok: true, status: 200, json: async () => ({ user: { pseudo: 'sam' } }) }))
    render(<App />)
    expect(await screen.findByText('sam')).toBeTruthy()
    expect(screen.queryByLabelText('Mot de passe')).toBeNull()
  })

  it('propose de se reconnecter si la session ne peut pas être vérifiée', async () => {
    vi.stubGlobal('fetch', route({ ok: true, status: 200, json: async () => ({}) }))
    render(<App />)
    expect(await screen.findByText(/Session indisponible/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Se connecter' })).toBeTruthy()
  })

  it('revient au formulaire après la déconnexion', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      if (url === '/api/auth/me') {
        return { ok: true, status: 200, json: async () => ({ user: { pseudo: 'sam' } }) }
      }
      if (url === '/api/auth/logout') return { ok: true, status: 204 }
      return healthyResponse()
    }))

    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'Se déconnecter' }))
    expect(await screen.findByRole('button', { name: 'Se connecter' })).toBeTruthy()
    expect(screen.queryByText('sam')).toBeNull()
  })

  it('propose le formulaire à un visiteur', async () => {
    vi.stubGlobal('fetch', route({ ok: false, status: 401, json: async () => ({}) }))
    render(<App />)
    expect(await screen.findByLabelText('Mot de passe')).toBeTruthy()
  })
})

describe('choix d’équipe avant la première pose', () => {
  it('laisse lire la toile puis autorise une pose après avoir rejoint une équipe', async () => {
    const date = '2026-11-20T12:00:00.000Z'
    const team = { id: 'rouge', name: 'Rouge', color: '#D93A3A' }
    const user = { pseudo: 'sam', team: null }
    const snapshot = parseCanvasSnapshot({ width: 101, height: 101, revision: 0, snapshotAt: date, pixels: [] })
    vi.mocked(subscribeCanvas).mockImplementationOnce((listener) => {
      listener({ canvas: snapshot, status: 'live' })
      return () => {}
    })
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ clearRect() {}, fillRect() {} })
    const ok = (payload) => ({ ok: true, status: 200, json: async () => payload })
    const fetch = vi.fn(async (url) => {
      switch (url) {
        case '/api/auth/me': return ok({ user })
        case '/api/teams': return ok({ teams: [team] })
        case '/api/auth/me/team': return ok({ user: { ...user, team }, teamChangeAvailableAt: date })
        case '/api/pixels': return ok({
          pixel: { x: 0, y: 0, color: '#000000', updatedAt: date, revision: 1 },
          cooldownEndsAt: date,
        })
        default: return healthyResponse()
      }
    })
    vi.stubGlobal('fetch', fetch)

    render(<App />)
    const teamSelect = await screen.findByRole('combobox', { name: 'Équipe à rejoindre' })
    expect(screen.getByRole('img')).toBeTruthy()
    expect(screen.getByText('Choisissez une équipe avant de poser un pixel.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Poser le pixel' })).toBeNull()

    fireEvent.change(teamSelect, { target: { value: team.id } })
    fireEvent.click(screen.getByRole('button', { name: 'Rejoindre l’équipe' }))
    const place = await screen.findByRole('button', { name: 'Poser le pixel' })
    expect(screen.getByText('sam').parentElement.textContent).toContain('Équipe Rouge')
    expect(fetch).toHaveBeenCalledWith('/api/auth/me/team', expect.objectContaining({
      method: 'PUT',
      body: JSON.stringify({ teamId: team.id }),
    }))

    fireEvent.click(place)
    expect(await screen.findByText('Pixel noir posé en (0, 0).')).toBeTruthy()
    expect(fetch).toHaveBeenCalledWith('/api/pixels', expect.objectContaining({ method: 'POST' }))
  })
})
