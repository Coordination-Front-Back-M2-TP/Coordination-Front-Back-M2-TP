// @vitest-environment jsdom
import { StrictMode } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App.jsx'

vi.mock('./api/canvas.js', () => ({ subscribeCanvas: () => () => {} }))

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
    expect(screen.queryByRole('heading', { name: 'Créer une équipe' })).toBeNull()
  })
})

describe('création d’équipe', () => {
  function renderWithTeamApi(response) {
    const fetch = vi.fn(async (url) => {
      if (url === '/api/auth/me') {
        return { ok: true, json: async () => ({ user: { pseudo: 'sam', team: null, role: 'player' } }) }
      }
      if (url === '/api/teams') return response()
      return healthyResponse()
    })

    vi.stubGlobal('fetch', fetch)
    render(<App />)
    return fetch
  }

  async function fillTeam(name, color = '#9333EA') {
    fireEvent.change(await screen.findByLabelText('Nom de l’équipe'), { target: { value: name } })
    fireEvent.change(screen.getByLabelText('Couleur de l’équipe'), { target: { value: color } })
    return screen.getByRole('button', { name: 'Créer l’équipe' })
  }

  it('propose les 16 couleurs et affiche la nouvelle équipe près du pseudo après le POST', async () => {
    const team = { id: 'les-eclairs', name: 'Les Éclairs', color: '#9333EA' }
    let finishCreation
    const fetch = renderWithTeamApi(() => new Promise((resolve) => { finishCreation = resolve }))
    const submit = await fillTeam('  Les Éclairs  ')
    expect(screen.getByLabelText('Couleur de l’équipe').options).toHaveLength(17)

    fireEvent.click(submit)
    expect(submit.matches(':disabled')).toBe(true)
    expect(screen.queryByText(team.name)).toBeNull()
    expect(fetch).toHaveBeenCalledWith('/api/teams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ name: 'Les Éclairs', color: '#9333EA' }),
    })

    await act(async () => finishCreation({
      ok: true,
      status: 201,
      json: async () => ({
        team,
        user: { pseudo: 'sam', team },
        teamChangeAvailableAt: new Date(Date.now() + 300_000).toISOString(),
      }),
    }))

    expect(screen.getByText('sam').parentElement.textContent).toContain('Équipe Les Éclairs')
    expect(screen.getByText('Vous avez créé et rejoint l’équipe Les Éclairs.')).toBeTruthy()
    expect(screen.getByText(/Prochain changement d’équipe dans/)).toBeTruthy()
    expect(submit.disabled).toBe(true)
  })

  it.each(['  ab ', 'x'.repeat(21), 'Nom !'])('refuse le nom invalide %s avant le POST', async (name) => {
    const fetch = renderWithTeamApi(() => { throw new Error('POST inattendu') })
    fireEvent.click(await fillTeam(name))

    expect(screen.getByRole('alert').textContent).toContain('Le nom d’équipe est invalide')
    expect(fetch).not.toHaveBeenCalledWith('/api/teams', expect.anything())
  })

  it.each([
    [400, 'INVALID_INPUT', 'Vérifiez le nom et la couleur'],
    [401, 'UNAUTHORIZED', 'Reconnectez-vous'],
    [403, 'ACCOUNT_BANNED', 'Votre compte est banni'],
    [409, 'TEAM_NAME_TAKEN', 'Ce nom d’équipe est déjà utilisé'],
    [500, 'INTERNAL_SERVER_ERROR', 'Impossible de créer l’équipe'],
  ])('affiche l’erreur %s et conserve la saisie', async (status, code, message) => {
    renderWithTeamApi(() => ({
      ok: false,
      status,
      json: async () => ({ error: { code } }),
    }))
    const submit = await fillTeam('Les Éclairs')
    fireEvent.click(submit)

    expect((await screen.findByRole('alert')).textContent).toContain(message)
    expect(screen.getByLabelText('Nom de l’équipe').value).toBe('Les Éclairs')
    expect(screen.getByLabelText('Couleur de l’équipe').value).toBe('#9333EA')
    expect(screen.getByText('sam').parentElement.textContent).not.toContain('Les Éclairs')
    expect(submit.disabled).toBe(false)
  })

  it('bloque une nouvelle création pendant le délai annoncé par le serveur', async () => {
    renderWithTeamApi(() => ({
      ok: false,
      status: 429,
      headers: new Headers({ 'Retry-After': '23' }),
      json: async () => ({ error: { code: 'TEAM_CHANGE_COOLDOWN' } }),
    }))
    const submit = await fillTeam('Les Éclairs')
    fireEvent.click(submit)

    expect(await screen.findByText('Prochain changement d’équipe dans 23 s.')).toBeTruthy()
    expect(submit.disabled).toBe(true)
    expect(screen.getByLabelText('Nom de l’équipe').value).toBe('Les Éclairs')
  })
})
