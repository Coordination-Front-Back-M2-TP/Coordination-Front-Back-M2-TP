import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { once } from 'node:events'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { after, before, test } from 'node:test'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import prismaClient from '@prisma/client'
import { io as createClient } from 'socket.io-client'
import { DEMO_ACCOUNT, SESSION_HEADER } from '../src/auth/session-placeholder.js'
import { createCanvasRepository } from '../src/canvas/canvas-repository.js'
import { PIXEL_COOLDOWN_MS } from '../src/canvas/canvas-service.js'
import { createCanvasServer } from '../src/server.js'

const backDirectory = fileURLToPath(new URL('../', import.meta.url))
const databasePath = join(backDirectory, 'prisma', `test-place-pixel-${process.pid}.db`)
const databaseUrl = `file:./prisma/test-place-pixel-${process.pid}.db`
const { PrismaClient } = prismaClient
let prisma
let repository
let server
let baseUrl

before(async () => {
  execFileSync(process.execPath, [join(backDirectory, 'scripts', 'prisma.js'), 'migrate', 'deploy'], {
    cwd: backDirectory,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'pipe',
  })

  prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: databaseUrl }) })
  repository = createCanvasRepository(prisma)
  server = createCanvasServer({ repository })
  server.httpServer.listen(0)
  await once(server.httpServer, 'listening')
  baseUrl = `http://localhost:${server.httpServer.address().port}`
})

after(async () => {
  if (server) await new Promise((resolve) => server.io.close(resolve))
  if (prisma) await prisma.$disconnect()
  await rm(databasePath, { force: true })
  await rm(`${databasePath}-journal`, { force: true })
  await rm(`${databasePath}-shm`, { force: true })
  await rm(`${databasePath}-wal`, { force: true })
})

function connect() {
  const socket = createClient(baseUrl, { autoConnect: false })
  const connected = once(socket, 'connect')
  socket.connect()
  return connected.then(() => socket)
}

function subscribe(socket) {
  return new Promise((resolve, reject) => {
    socket.timeout(1000).emit('canvas:subscribe', (error, snapshot) => {
      if (error) reject(error)
      else resolve(snapshot)
    })
  })
}

function placePixel(body, { withSession = true } = {}) {
  const headers = { 'content-type': 'application/json' }
  if (withSession) headers[SESSION_HEADER] = 'session-de-test'
  return fetch(`${baseUrl}/api/pixels`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
}

test('une pose acceptée renvoie le pixel et le délai, est visible et diffusée, et remplit l’historique', async (t) => {
  const socket = await connect()
  t.after(() => socket.disconnect())
  const snapshotBefore = await subscribe(socket)
  assert.equal(snapshotBefore.revision, 0)

  const broadcast = once(socket, 'pixel:updated')
  const response = await placePixel({ x: 12, y: 8, color: '#D93A3A' })
  assert.equal(response.status, 200)

  const body = await response.json()
  assert.deepEqual(Object.keys(body).sort(), ['cooldownEndsAt', 'pixel'])
  assert.equal(body.pixel.x, 12)
  assert.equal(body.pixel.y, 8)
  assert.equal(body.pixel.color, '#D93A3A')
  assert.equal(body.pixel.revision, 1)
  assert.equal(Number.isFinite(Date.parse(body.pixel.updatedAt)), true)
  // Le délai est calculé depuis l'heure serveur d'enregistrement, mais n'est
  // pas encore contraignant : son rejet est l'issue #46.
  assert.equal(
    Date.parse(body.cooldownEndsAt) - Date.parse(body.pixel.updatedAt),
    PIXEL_COOLDOWN_MS,
  )
  // L'historique n'apparaît ni dans la réponse ni dans l'événement diffusé.
  assert.equal(JSON.stringify(body).includes(DEMO_ACCOUNT.accountId), false)

  const [broadcastedPixel] = await broadcast
  assert.deepEqual(broadcastedPixel, body.pixel)

  const httpSnapshot = await (await fetch(`${baseUrl}/api/pixels`)).json()
  assert.equal(httpSnapshot.revision, 1)
  assert.deepEqual(httpSnapshot.pixels, [body.pixel])

  const history = await prisma.pixelPlacement.findMany()
  assert.equal(history.length, 1)
  assert.deepEqual({
    accountId: history[0].accountId,
    teamId: history[0].teamId,
    x: history[0].x,
    y: history[0].y,
    color: history[0].color,
    revision: history[0].revision,
  }, {
    accountId: DEMO_ACCOUNT.accountId,
    teamId: DEMO_ACCOUNT.teamId,
    x: 12,
    y: 8,
    color: '#D93A3A',
    revision: 1,
  })
  assert.equal(history[0].placedAt.toISOString(), body.pixel.updatedAt)
})

test('les révisions des poses suivent celles de la toile, y compris en remplacement', async () => {
  const first = await (await placePixel({ x: -50, y: 50, color: '#123456' })).json()
  const second = await (await placePixel({ x: -50, y: 50, color: '#abcdef' })).json()

  assert.equal(first.pixel.revision, 2)
  assert.equal(second.pixel.revision, 3)

  const snapshot = await repository.getSnapshot()
  assert.equal(snapshot.revision, 3)
  assert.deepEqual(snapshot.pixels.filter(({ x, y }) => x === -50 && y === 50), [second.pixel])

  // L'historique conserve chaque pose, même celle remplacée depuis.
  const history = await prisma.pixelPlacement.findMany({ orderBy: { revision: 'asc' } })
  assert.equal(history.length, 3)
  assert.deepEqual(
    history.slice(1).map(({ revision, color }) => ({ revision, color })),
    [{ revision: 2, color: '#123456' }, { revision: 3, color: '#abcdef' }],
  )
})

test('des coordonnées ou une couleur invalides sont refusées sans rien modifier', async () => {
  const invalidBodies = [
    { x: 51, y: 0, color: '#123456' },
    { x: 0, y: -51, color: '#123456' },
    { x: 1.5, y: 0, color: '#123456' },
    { x: '12', y: 8, color: '#123456' },
    { x: 0, y: 0, color: 'red' },
    { x: 0, y: 0, color: '#12345' },
    { x: 0, y: 0 },
    {},
  ]

  for (const body of invalidBodies) {
    const response = await placePixel(body)
    assert.equal(response.status, 400, JSON.stringify(body))
    const error = await response.json()
    assert.equal(error.error.code, 'INVALID_INPUT')
  }

  // Une pose refusée ne modifie ni la toile, ni l'historique, ni la révision.
  const snapshot = await repository.getSnapshot()
  assert.equal(snapshot.revision, 3)
  assert.equal(await prisma.pixelPlacement.count(), 3)
})

test('sans session, la pose est refusée avec 401 et rien n’est modifié', async () => {
  const response = await placePixel({ x: 0, y: 0, color: '#123456' }, { withSession: false })
  assert.equal(response.status, 401)
  const error = await response.json()
  assert.equal(error.error.code, 'UNAUTHORIZED')
  assert.equal(typeof error.error.message, 'string')

  const snapshot = await repository.getSnapshot()
  assert.equal(snapshot.revision, 3)
  assert.equal(snapshot.pixels.some(({ x, y }) => x === 0 && y === 0), false)
  assert.equal(await prisma.pixelPlacement.count(), 3)
})
