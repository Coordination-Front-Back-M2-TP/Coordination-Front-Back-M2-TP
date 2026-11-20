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
import { createApp } from '../src/app.js'
import { createCanvasRepository } from '../src/canvas/canvas-repository.js'
import { createCanvasServer } from '../src/server.js'

const backDirectory = fileURLToPath(new URL('../', import.meta.url))
const databasePath = join(backDirectory, 'prisma', `test-pose-${process.pid}.db`)
const databaseUrl = `file:./prisma/test-pose-${process.pid}.db`
const { PrismaClient } = prismaClient
let prisma
let server
let baseUrl

// Session factice pour les tests : l'en-tête désigne le compte connecté, l'équipe en découle.
// La vraie session arrivera avec l'authentification (#18).
async function testPlayer(req) {
  const accountId = req.get('x-test-account')
  return accountId ? { accountId, teamId: `equipe-de-${accountId}` } : null
}

before(async () => {
  execFileSync(process.execPath, [join(backDirectory, 'scripts', 'prisma.js'), 'migrate', 'deploy'], {
    cwd: backDirectory,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'pipe',
  })
  prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: databaseUrl }) })
  // Délai désactivé : ces tests enchaînent les poses d'un même compte. Le délai est couvert par cooldown.test.js.
  server = createCanvasServer({ repository: createCanvasRepository(prisma), resolvePlayer: testPlayer, cooldownMs: 0 })
  server.httpServer.listen(0)
  await once(server.httpServer, 'listening')
  baseUrl = `http://localhost:${server.httpServer.address().port}`
})

after(async () => {
  if (server) await new Promise((resolve) => server.io.close(resolve))
  if (prisma) await prisma.$disconnect()
  for (const suffix of ['', '-journal', '-shm', '-wal']) await rm(`${databasePath}${suffix}`, { force: true })
})

function pose(body, account = 'alice') {
  return fetch(`${baseUrl}/api/pixels`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(account ? { 'x-test-account': account } : {}) },
    body: JSON.stringify(body),
  })
}

test('un joueur connecté pose un pixel, diffusé à la toile et inscrit dans l’historique', async (t) => {
  const socket = createClient(baseUrl)
  t.after(() => socket.disconnect())
  await once(socket, 'connect')
  await socket.timeout(1000).emitWithAck('canvas:subscribe')
  const broadcast = once(socket, 'pixel:updated')

  const startedAt = Date.now()
  const response = await pose({ x: 12, y: -8, color: '#d93a3a', accountId: 'pirate', teamId: 'pirates' })
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.deepEqual(Object.keys(body).sort(), ['cooldownEndsAt', 'pixel'])
  assert.equal(body.pixel.x, 12)
  assert.equal(body.pixel.y, -8)
  assert.equal(body.pixel.color, '#D93A3A')
  assert.equal(Number.isFinite(Date.parse(body.cooldownEndsAt)), true)

  const [pixel] = await broadcast
  assert.deepEqual(pixel, body.pixel)

  const history = await prisma.pixelPlacement.findMany()
  assert.equal(history.length, 1)
  assert.equal(history[0].accountId, 'alice')
  assert.equal(history[0].teamId, 'equipe-de-alice')
  assert.equal(history[0].revision, body.pixel.revision)
  assert.equal(history[0].placedAt.toISOString(), body.pixel.updatedAt)
  assert.equal(history[0].placedAt.getTime() >= startedAt - 1000, true)
})

test('l’historique garde chaque pose, même quand elle remplace un pixel visible', async () => {
  assert.equal((await pose({ x: 0, y: 0, color: '#123456' }, 'alice')).status, 200)
  assert.equal((await pose({ x: 0, y: 0, color: '#654321' }, 'bob')).status, 200)

  const history = await prisma.pixelPlacement.findMany({ where: { x: 0, y: 0 }, orderBy: { revision: 'asc' } })
  assert.deepEqual(history.map(({ accountId, color }) => [accountId, color]), [['alice', '#123456'], ['bob', '#654321']])
  assert.equal(await prisma.pixel.count({ where: { x: 0, y: 0 } }), 1)
})

test('sans compte, la pose est refusée en 401 et rien n’est écrit', async () => {
  const before = await prisma.pixelPlacement.count()
  const response = await pose({ x: 1, y: 1, color: '#123456' }, null)
  assert.equal(response.status, 401)
  assert.equal((await response.json()).error.code, 'UNAUTHORIZED')
  assert.equal(await prisma.pixelPlacement.count(), before)
  assert.equal(await prisma.pixel.count({ where: { x: 1, y: 1 } }), 0)
})

test('sans authentification branchée, l’application refuse toute pose', async (t) => {
  const plain = createApp({ canvasService: server.canvasService }).listen(0)
  t.after(() => plain.close())
  await once(plain, 'listening')
  const response = await fetch(`http://localhost:${plain.address().port}/api/pixels`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-test-account': 'alice' },
    body: JSON.stringify({ x: 1, y: 1, color: '#123456' }),
  })
  assert.equal(response.status, 401)
})

test('refuse en 400 INVALID_INPUT les coordonnées et couleurs hors contrat', async () => {
  const before = await prisma.pixelPlacement.count()
  const invalid = [
    {},
    { x: 51, y: 0, color: '#123456' },
    { x: 0, y: -51, color: '#123456' },
    { x: 1.5, y: 0, color: '#123456' },
    { x: '1', y: 0, color: '#123456' },
    { x: 0, y: 0, color: 'red' },
    { x: 0, y: 0 },
    [],
  ]
  for (const body of invalid) {
    const response = await pose(body)
    assert.equal(response.status, 400, JSON.stringify(body))
    assert.equal((await response.json()).error.code, 'INVALID_INPUT')
  }
  assert.equal(await prisma.pixelPlacement.count(), before)
})

test('accepte les coins de la toile', async () => {
  for (const [x, y] of [[-50, -50], [50, 50], [-50, 50], [50, -50]]) {
    assert.equal((await pose({ x, y, color: '#000000' })).status, 200)
  }
})
