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
import { createCanvasRepository } from '../src/canvas/canvas-repository.js'
import { createCanvasServer } from '../src/server.js'

const backDirectory = fileURLToPath(new URL('../', import.meta.url))
const databasePath = join(backDirectory, 'prisma', `test-canvas-${process.pid}.db`)
const databaseUrl = `file:./prisma/test-canvas-${process.pid}.db`
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

test('la lecture publique et la souscription renvoient l’instantané courant', async (t) => {
  const socket = await connect()
  t.after(() => socket.disconnect())

  const response = await fetch(`${baseUrl}/api/pixels`)
  assert.equal(response.status, 200)
  const httpSnapshot = await response.json()
  assert.deepEqual({
    width: httpSnapshot.width,
    height: httpSnapshot.height,
    revision: httpSnapshot.revision,
    pixels: httpSnapshot.pixels,
  }, {
    width: 101,
    height: 101,
    revision: 0,
    pixels: [],
  })
  assert.equal(Number.isFinite(Date.parse(httpSnapshot.snapshotAt)), true)

  const snapshot = await subscribe(socket)
  assert.equal(snapshot.width, 101)
  assert.equal(snapshot.height, 101)
  assert.equal(snapshot.revision, 0)
  assert.deepEqual(snapshot.pixels, [])
})

test('persiste une pose avant de la diffuser et la conserve après reconnexion', async (t) => {
  const socket = await connect()
  t.after(() => socket.disconnect())
  await subscribe(socket)

  const received = new Promise((resolve) => {
    socket.once('pixel:updated', async (pixel) => {
      const snapshot = await repository.getSnapshot()
      resolve({ pixel, snapshot })
    })
  })
  const startedAt = Date.now()
  const savedPixel = await server.canvasService.savePixel({ x: 0, y: -3, color: '#D93A3A' })
  const { pixel, snapshot } = await received

  assert.deepEqual(pixel, savedPixel)
  assert.equal(Date.now() - startedAt < 1000, true)
  assert.equal(snapshot.revision, savedPixel.revision)
  assert.deepEqual(snapshot.pixels, [savedPixel])

  const replacement = await server.canvasService.savePixel({ x: 0, y: -3, color: '#123456' })
  assert.equal(replacement.revision, savedPixel.revision + 1)
  assert.equal((await repository.getSnapshot()).pixels.length, 1)

  const reopenedPrisma = new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: databaseUrl }),
  })
  const reopenedSnapshot = await createCanvasRepository(reopenedPrisma).getSnapshot()
  await reopenedPrisma.$disconnect()
  assert.equal(reopenedSnapshot.revision, replacement.revision)
  assert.deepEqual(reopenedSnapshot.pixels, [replacement])

  const newSocket = await connect()
  t.after(() => newSocket.disconnect())
  const reconnectedSnapshot = await subscribe(newSocket)
  assert.equal(reconnectedSnapshot.revision, replacement.revision)
  assert.deepEqual(reconnectedSnapshot.pixels, [replacement])
})

test('refuse les coordonnées ou couleurs hors contrat sans modifier la toile', async () => {
  await assert.rejects(server.canvasService.savePixel(null), { name: 'TypeError' })
  await assert.rejects(
    server.canvasService.savePixel({ x: 51, y: 0, color: '#123456' }),
    { name: 'TypeError' },
  )
  await assert.rejects(
    server.canvasService.savePixel({ x: 0, y: 0, color: 'red' }),
    { name: 'TypeError' },
  )
  assert.equal((await repository.getSnapshot()).revision, 2)
})

test('attribue des révisions distinctes à des écritures simultanées', async () => {
  const savedPixels = await Promise.all(Array.from({ length: 8 }, (_, index) => (
    server.canvasService.savePixel({ x: index, y: 1, color: '#123456' })
  )))
  const revisions = savedPixels.map(({ revision }) => revision).sort((a, b) => a - b)

  assert.deepEqual(revisions, [3, 4, 5, 6, 7, 8, 9, 10])
  const snapshot = await repository.getSnapshot()
  assert.equal(snapshot.revision, 10)
  assert.equal(snapshot.pixels.length, 9)
})

test('les erreurs d’abonnement n’exposent que le code et le message', async (t) => {
  const unavailableServer = createCanvasServer({
    repository: {
      getSnapshot: async () => {
        throw new Error('détail interne')
      },
      savePixel: async () => {
        throw new Error('détail interne')
      },
    },
  })
  unavailableServer.httpServer.listen(0)
  await once(unavailableServer.httpServer, 'listening')
  t.after(() => new Promise((resolve) => unavailableServer.io.close(resolve)))

  const socket = createClient(`http://localhost:${unavailableServer.httpServer.address().port}`)
  t.after(() => socket.disconnect())
  await once(socket, 'connect')
  const errorEvent = once(socket, 'canvas:error')
  socket.emit('canvas:subscribe')
  const error = await errorEvent

  assert.deepEqual(error[0], {
    error: {
      code: 'BOARD_UNAVAILABLE',
      message: 'La toile est momentanément indisponible.',
    },
  })
  assert.equal(JSON.stringify(error).includes('détail interne'), false)
})
