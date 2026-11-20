// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AccountBar } from './AccountBar.jsx'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('AccountBar', () => {
  it('se déconnecte', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 })
    vi.stubGlobal('fetch', fetchMock)
    const onLoggedOut = vi.fn()
    render(<AccountBar user={{ pseudo: 'sam' }} onLoggedOut={onLoggedOut} />)
    expect(screen.getByText('sam')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Se déconnecter' }))
    await waitFor(() => expect(onLoggedOut).toHaveBeenCalled())
    expect(fetchMock.mock.calls[0][0]).toBe('/api/auth/logout')
  })

  it("reste connecté et prévient si la déconnexion échoue", async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('x')))
    const onLoggedOut = vi.fn()
    render(<AccountBar user={{ pseudo: 'sam' }} onLoggedOut={onLoggedOut} />)
    fireEvent.click(screen.getByRole('button', { name: 'Se déconnecter' }))
    await screen.findByRole('alert')
    expect(onLoggedOut).not.toHaveBeenCalled()
  })
})
