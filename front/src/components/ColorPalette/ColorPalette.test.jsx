// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { PALETTE } from '../../api/palette.js'
import { ColorPalette } from './ColorPalette.jsx'

afterEach(cleanup)

it('nomme chaque couleur et signale le choix', () => {
  const onChange = vi.fn()
  render(<ColorPalette colors={PALETTE} value="#000000" onChange={onChange} />)
  expect(screen.getByRole('group', { name: 'Couleur' })).toBeTruthy()
  expect(screen.getAllByRole('radio')).toHaveLength(PALETTE.length)
  expect(screen.getByRole('radio', { name: 'Noir' }).checked).toBe(true)
  fireEvent.click(screen.getByRole('radio', { name: 'Rouge' }))
  expect(onChange).toHaveBeenCalledWith('#D93A3A')
})

it('la palette provisoire ne contient que des couleurs #RRGGBB distinctes', () => {
  const colors = PALETTE.map(({ color }) => color)
  expect(colors.every((color) => /^#[0-9A-F]{6}$/.test(color))).toBe(true)
  expect(new Set(colors).size).toBe(colors.length)
})
