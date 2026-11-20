// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { Ranking } from './Ranking.jsx'

afterEach(cleanup)

it('affiche les rangs, les égalités et les comptes avec les noms des équipes', () => {
  const teams = new Map([
    ['a', { name: 'Rouge', color: '#D93A3A' }],
    ['b', { name: 'Bleue', color: '#2F6FDE' }],
  ])
  render(<Ranking status="live" teams={teams} ranking={{ teams: [
    { teamId: 'a', rank: 1, pixelCount: 3 },
    { teamId: 'b', rank: 1, pixelCount: 3 },
  ] }} />)
  expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
    'Rang 1 — Rouge : 3 pixels', 'Rang 1 — Bleue : 3 pixels',
  ])
})

it('affiche un classement vide et signale une erreur avec une action de reprise', () => {
  const retry = vi.fn()
  render(<Ranking status="error" teams={new Map()} ranking={{ teams: [] }} onRetry={retry} />)
  expect(screen.getByText(/Aucune équipe/)).toBeTruthy()
  expect(screen.getByText(/il peut avoir changé/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Réessayer le classement' }))
  expect(retry).toHaveBeenCalledOnce()
})
