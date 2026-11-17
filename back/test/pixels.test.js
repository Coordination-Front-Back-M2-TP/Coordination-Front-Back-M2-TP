import assert from 'node:assert/strict'
import { once } from 'node:events'
import { test } from 'node:test'
import { createApp } from '../src/app.js'
import { createCanvasStore } from '../src/services/canvas-store.js'

async function startTestApp(t, store) {
  const server = createApp(store).listen(0)
  t.after(() => server.close())
  await once(server, 'listening')
  return `http://localhost:${server.address().port}`
}

test('GET /api/pixels sur une toile vide renvoie un instantané au format du contrat', async (t) => {
  const address = await startTestApp(t, createCanvasStore())

  const response = await fetch(`${address}/api/pixels`)

  assert.equal(response.status, 200)
  const snapshot = await response.json()
  assert.deepEqual(Object.keys(snapshot).sort(), ['height', 'pixels', 'revision', 'snapshotAt', 'width'])
  assert.equal(snapshot.width, 101)
  assert.equal(snapshot.height, 101)
  assert.equal(snapshot.revision, 0)
  assert.deepEqual(snapshot.pixels, [])
  assert.ok(Number.isFinite(Date.parse(snapshot.snapshotAt)))
})

test('GET /api/pixels renvoie les pixels posés, sans compte, avec leurs révisions', async (t) => {
  const store = createCanvasStore()
  const premier = store.placePixel({ x: 12, y: 8, color: '#D93A3A' })
  const deuxieme = store.placePixel({ x: -50, y: 50, color: '#2563EB' })
  const address = await startTestApp(t, store)

  const response = await fetch(`${address}/api/pixels`)

  assert.equal(response.status, 200)
  const snapshot = await response.json()
  assert.equal(snapshot.revision, 2)
  assert.equal(snapshot.pixels.length, 2)
  assert.deepEqual(snapshot.pixels, [premier, deuxieme])
  for (const pixel of snapshot.pixels) {
    assert.ok(pixel.revision <= snapshot.revision)
    assert.match(pixel.color, /^#[0-9a-f]{6}$/i)
  }
})

test('GET /api/pixels reflète la dernière pose, sans doublon de coordonnée', async (t) => {
  const store = createCanvasStore()
  store.placePixel({ x: 0, y: 0, color: '#D93A3A' })
  const derniere = store.placePixel({ x: 0, y: 0, color: '#22C55E' })
  const address = await startTestApp(t, store)

  const response = await fetch(`${address}/api/pixels`)
  const snapshot = await response.json()

  assert.equal(snapshot.pixels.length, 1)
  assert.deepEqual(snapshot.pixels[0], derniere)
})
