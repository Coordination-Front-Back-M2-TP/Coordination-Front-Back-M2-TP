// @vitest-environment jsdom
import { useEffect } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ErrorBoundary } from './ErrorBoundary.jsx'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

it('affiche normalement le contenu sans erreur', () => {
  render(<ErrorBoundary><p>Contenu de l’application</p></ErrorBoundary>)
  expect(screen.getByText('Contenu de l’application')).toBeTruthy()
  expect(screen.queryByRole('alert')).toBeNull()
})

it('remplace un rendu en erreur par un message de repli sans détail interne', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  function Broken() { throw new Error('secret') }
  render(<ErrorBoundary><Broken /></ErrorBoundary>)
  expect(screen.getByRole('alert').textContent).toContain('Rechargez la page pour réessayer')
  expect(document.body.textContent).not.toContain('secret')
})

it('retire le contenu devenu invalide lorsqu’un effet React échoue', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  function BrokenEffect() {
    useEffect(() => { throw new Error('secret') }, [])
    return <p>Ancien état de réussite</p>
  }
  render(<ErrorBoundary><BrokenEffect /></ErrorBoundary>)
  expect(screen.getByRole('alert').textContent).toContain('Une erreur est survenue')
  expect(screen.queryByText('Ancien état de réussite')).toBeNull()
  expect(document.body.textContent).not.toContain('secret')
})
