// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App.jsx'
import { ErrorBoundary } from './components/ErrorBoundary.jsx'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('état de connexion', () => {
  it('affiche la connexion lorsque le serveur répond correctement', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 'ok' }) }))
    render(<App />)
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Back : ok'))
  })

  it.each([
    ['une erreur HTTP', () => Promise.resolve({ ok: false })],
    ['une erreur réseau', () => Promise.reject(new Error('secret'))],
    ['une réponse invalide', () => Promise.resolve({ ok: true, json: async () => ({ status: 'error' }) })],
  ])('affiche un état injoignable après %s', async (_case, response) => {
    vi.stubGlobal('fetch', vi.fn(response))
    render(<App />)
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Back : injoignable'))
    expect(document.body.textContent).not.toContain('secret')
  })
})

it('affiche un message de repli sans détail interne si le rendu échoue', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  function Broken() { throw new Error('secret') }
  render(<ErrorBoundary><Broken /></ErrorBoundary>)
  expect(screen.getByRole('alert').textContent).toContain('Rechargez la page')
  expect(document.body.textContent).not.toContain('secret')
})
