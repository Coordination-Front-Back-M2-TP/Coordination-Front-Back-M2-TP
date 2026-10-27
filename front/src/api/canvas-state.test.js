import { describe, expect, it } from 'vitest'
import { applyPixelUpdate, parseCanvasSnapshot } from './canvas-state.js'

const date = '2026-10-27T14:30:00.000Z'
const pixel = (overrides = {}) => ({ x: 0, y: 0, color: '#D93A3A', revision: 10, updatedAt: date, ...overrides })
const snapshot = (overrides = {}) => ({ width: 101, height: 101, revision: 10, snapshotAt: date, pixels: [], ...overrides })

describe('état visuel de la toile', () => {
  it('lit les dimensions serveur et les deux bornes autour de l’origine', () => {
    const canvas = parseCanvasSnapshot(snapshot({ width: 3, height: 5, pixels: [pixel({ x: -1, y: -2 }), pixel({ x: 1, y: 2 })] }))
    expect(canvas.width).toBe(3)
    expect(canvas.height).toBe(5)
    expect(canvas.pixels.size).toBe(2)
  })

  it('conserve uniquement l’état visuel public', () => {
    const canvas = parseCanvasSnapshot(snapshot({ pixels: [pixel({ userId: 'privé', history: ['privé'] })], players: ['privé'] }))
    expect(JSON.stringify([...canvas.pixels.values()])).not.toContain('privé')
    expect(canvas).not.toHaveProperty('players')
  })

  it.each([
    ['dimensions invalides', { width: 0 }],
    ['coordonnée hors limites', { pixels: [pixel({ x: 51 })] }],
    ['couleur invalide', { pixels: [pixel({ color: 'red' })] }],
    ['couleur de type incorrect', { pixels: [pixel({ color: ['#D93A3A'] })] }],
    ['révision future', { pixels: [pixel({ revision: 11 })] }],
    ['coordonnée dupliquée', { pixels: [pixel(), pixel()] }],
    ['date absente', { snapshotAt: null }],
  ])('refuse un instantané incohérent : %s', (_case, invalid) => {
    expect(() => parseCanvasSnapshot(snapshot(invalid))).toThrow()
  })

  it('ne rejoue pas un événement déjà inclus dans l’instantané, même sur une case vide', () => {
    const canvas = parseCanvasSnapshot(snapshot())
    expect(applyPixelUpdate(canvas, pixel({ revision: 9 }))).toBe(canvas)
  })

  it('remplace un pixel sans doublon et ignore ses anciennes versions', () => {
    const canvas = parseCanvasSnapshot(snapshot({ pixels: [pixel()] }))
    const next = applyPixelUpdate(canvas, pixel({ color: '#2563EB', revision: 12 }))
    expect(next.pixels.size).toBe(1)
    expect(next.pixels.get('0,0').color).toBe('#2563EB')
    expect(applyPixelUpdate(next, pixel({ revision: 11 }))).toBe(next)
    expect(applyPixelUpdate(next, pixel({ revision: 12 }))).toBe(next)
    expect(canvas.pixels.get('0,0').color).toBe('#D93A3A')
  })

  it('accepte une révision intermédiaire sur une autre coordonnée', () => {
    const canvas = applyPixelUpdate(parseCanvasSnapshot(snapshot()), pixel({ revision: 12 }))
    const next = applyPixelUpdate(canvas, pixel({ x: 1, revision: 11 }))
    expect(next.pixels.size).toBe(2)
    expect(next.revision).toBe(12)
  })
})
