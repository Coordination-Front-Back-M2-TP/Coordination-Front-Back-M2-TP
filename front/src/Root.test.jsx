// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Root } from './Root.jsx'

vi.mock('./api/canvas.js', () => ({ subscribeCanvas: () => () => {} }))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('choix de la page', () => {
  it.each(['/', '/index.html'])('affiche la toile pour %s', (pathname) => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
    render(<Root pathname={pathname} />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('P1X3L')
  })

  it('affiche la page introuvable pour une adresse inconnue, avec un lien vers la toile', () => {
    render(<Root pathname="/nimporte-quoi" />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Page introuvable')
    expect(screen.getByText('/nimporte-quoi')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Revenir à la toile' }).getAttribute('href')).toBe('/')
  })
})
