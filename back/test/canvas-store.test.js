import assert from 'node:assert/strict'
import { test } from 'node:test'
import { AppError } from '../src/errors/app-error.js'
import { createCanvasStore } from '../src/services/canvas-store.js'

test('placePixel renvoie le Pixel canonique enregistré', () => {
  const store = createCanvasStore()

  const pixel = store.placePixel({ x: 12, y: 8, color: '#D93A3A' })

  assert.equal(pixel.x, 12)
  assert.equal(pixel.y, 8)
  assert.equal(pixel.color, '#D93A3A')
  assert.equal(pixel.revision, 1)
  assert.ok(Number.isFinite(Date.parse(pixel.updatedAt)))
  assert.deepEqual(Object.keys(pixel).sort(), ['color', 'revision', 'updatedAt', 'x', 'y'])
})

test('les révisions sont strictement croissantes et sans doublon', () => {
  const store = createCanvasStore()
  const revisions = [
    store.placePixel({ x: -50, y: -50, color: '#D93A3A' }).revision,
    store.placePixel({ x: 0, y: 0, color: '#2563EB' }).revision,
    store.placePixel({ x: 50, y: 50, color: '#22C55E' }).revision,
    store.placePixel({ x: 0, y: 0, color: '#FACC15' }).revision,
  ]

  assert.deepEqual(revisions, [1, 2, 3, 4])
  assert.equal(store.getSnapshot().revision, 4)
})

test('un pixel reposé sur la même coordonnée ne crée pas de doublon', () => {
  const store = createCanvasStore()
  store.placePixel({ x: 3, y: -7, color: '#D93A3A' })
  const second = store.placePixel({ x: 3, y: -7, color: '#2563EB' })

  const snapshot = store.getSnapshot()
  assert.equal(snapshot.pixels.length, 1)
  assert.deepEqual(snapshot.pixels[0], second)
})

test('les bornes -50 et 50 sont incluses, au-delà la pose est refusée', () => {
  const store = createCanvasStore()
  assert.equal(store.placePixel({ x: -50, y: 50, color: '#D93A3A' }).revision, 1)

  for (const coordinates of [
    { x: 51, y: 0 },
    { x: 0, y: -51 },
    { x: 1.5, y: 0 },
    { x: 0, y: Number.NaN },
    { x: '3', y: 0 },
  ]) {
    assert.throws(
      () => store.placePixel({ ...coordinates, color: '#D93A3A' }),
      (error) => error instanceof AppError && error.statusCode === 400 && error.code === 'INVALID_INPUT',
    )
  }
})

test('une couleur hors du format #RRGGBB est refusée', () => {
  const store = createCanvasStore()

  for (const color of ['red', '#FFF', '#GGGGGG', 'D93A3A', 42, null]) {
    assert.throws(
      () => store.placePixel({ x: 0, y: 0, color }),
      (error) => error instanceof AppError && error.code === 'INVALID_INPUT',
    )
  }
  assert.equal(store.getSnapshot().revision, 0)
})

test('l’événement pixel:updated part seulement après l’enregistrement du pixel', () => {
  const store = createCanvasStore()
  let persistedAtEmit = null
  store.events.on('pixel:updated', (pixel) => {
    persistedAtEmit = store.getSnapshot().pixels.find(
      (candidate) => candidate.x === pixel.x && candidate.y === pixel.y,
    )
  })

  const pixel = store.placePixel({ x: -1, y: 1, color: '#D93A3A' })

  assert.deepEqual(persistedAtEmit, pixel)
})

test('une entrée invalide ne change ni la toile ni la révision', () => {
  const store = createCanvasStore()
  store.placePixel({ x: 0, y: 0, color: '#D93A3A' })

  assert.throws(() => store.placePixel({ x: 99, y: 0, color: '#D93A3A' }))

  const snapshot = store.getSnapshot()
  assert.equal(snapshot.revision, 1)
  assert.equal(snapshot.pixels.length, 1)
})
