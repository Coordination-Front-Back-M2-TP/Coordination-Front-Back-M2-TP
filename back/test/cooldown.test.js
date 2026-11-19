import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { once } from 'node:events'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { after, before, beforeEach, test } from 'node:test'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import prismaClient from '@prisma/client'
import { io as createClient } from 'socket.io-client'
import { createCanvasRepository } from '../src/canvas/canvas-repository.js'
import { readCooldownMs } from '../src/canvas/canvas-service.js'
import { createCanvasServer } from '../src/server.js'

const backDirectory = fileURLToPath(new URL('../', import.meta.url))
const databasePath = join(backDirectory, 'prisma', `test-cooldown-${process.pid}.db`)
const databaseUrl = `file:./prisma/test-cooldown-${process.pid}.db`
const { PrismaClient } = prismaClient
const COOLDOWN_MS = 10_000
const START = Date.parse('2026-10-27T14:30:00.000Z')
let prisma
let server
let baseUrl
// Horloge du serveur pilotée par les tests : le délai se vérifie sans attendre.
let clock = START

// Session factice, comme dans pose.test.js : l'en-tête désigne le compte connecté.
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
  server = createCanvasServer({
    repository: createCanvasRepository(prisma, { now: () => new Date(clock) }),
    resolvePlayer: testPlayer,
    cooldownMs: COOLDOWN_MS,
  })
  server.httpServer.listen(0)
  await once(server.httpServer, 'listening')
  baseUrl = `http://localhost:${server.httpServer.address().port}`
})

// Chaque test part d'une heure où tous les délais précédents sont écoulés.
beforeEach(() => {
  clock += 60_000
})

after(async () => {
  if (server) await new Promise((resolve) => server.io.close(resolve))
  if (prisma) await prisma.$disconnect()
  for (const suffix of ['', '-journal', '-shm', '-wal']) await rm(`${databasePath}${suffix}`, { force: true })
})

function pose(body, account = 'alice') {
  return fetch(`${baseUrl}/api/pixels`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-test-account': account },
    body: JSON.stringify(body),
  })
}

async function revision() {
  return (await (await fetch(`${baseUrl}/api/pixels`)).json()).revision
}

test('une pose acceptée renvoie la fin du délai, calculée à l’heure du serveur', async () => {
  const response = await pose({ x: 0, y: 0, color: '#123456' })
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.pixel.updatedAt, new Date(clock).toISOString())
  assert.equal(body.cooldownEndsAt, new Date(clock + COOLDOWN_MS).toISOString())
})

test('une pose pendant le délai est refusée en 429, avec le temps restant, et rien n’est écrit', async (t) => {
  assert.equal((await pose({ x: 1, y: 1, color: '#123456' })).status, 200)
  const revisionBefore = await revision()
  const historyBefore = await prisma.pixelPlacement.count()

  const socket = createClient(baseUrl)
  t.after(() => socket.disconnect())
  await once(socket, 'connect')
  await socket.timeout(1000).emitWithAck('canvas:subscribe')
  let broadcasts = 0
  socket.on('pixel:updated', () => { broadcasts += 1 })

  clock += 3_500
  const refused = await pose({ x: 2, y: 2, color: '#654321' })
  assert.equal(refused.status, 429)
  // 6,5 secondes restantes : l'en-tête arrondit au-dessus, pour ne jamais inviter à reposer trop tôt.
  assert.equal(refused.headers.get('retry-after'), '7')
  const body = await refused.json()
  assert.equal(body.error.code, 'COOLDOWN_ACTIVE')
  assert.equal(typeof body.error.message, 'string')

  // Le même pixel est refusé aussi : le délai porte sur le compte, pas sur la case.
  assert.equal((await pose({ x: 1, y: 1, color: '#654321' })).status, 429)

  assert.equal(await revision(), revisionBefore)
  assert.equal(await prisma.pixelPlacement.count(), historyBefore)
  assert.equal(await prisma.pixel.count({ where: { x: 2, y: 2 } }), 0)
  assert.equal((await prisma.pixel.findUnique({ where: { x_y: { x: 1, y: 1 } } })).color, '#123456')
  assert.equal(broadcasts, 0)
})

test('une pose refusée ne repousse pas le délai, et la pose redevient possible à son échéance', async () => {
  const first = await (await pose({ x: 3, y: 3, color: '#123456' })).json()

  clock += COOLDOWN_MS - 1
  const refused = await pose({ x: 3, y: 4, color: '#123456' })
  assert.equal(refused.status, 429)
  assert.equal(refused.headers.get('retry-after'), '1')

  clock += 1
  assert.equal(new Date(clock).toISOString(), first.cooldownEndsAt)
  const accepted = await pose({ x: 3, y: 4, color: '#123456' })
  assert.equal(accepted.status, 200)
  assert.equal((await accepted.json()).cooldownEndsAt, new Date(clock + COOLDOWN_MS).toISOString())
})

test('le délai porte sur le compte : un autre joueur pose pendant le délai du premier', async () => {
  assert.equal((await pose({ x: 5, y: 5, color: '#123456' }, 'alice')).status, 200)
  assert.equal((await pose({ x: 5, y: 6, color: '#123456' }, 'bob')).status, 200)
  assert.equal((await pose({ x: 5, y: 7, color: '#123456' }, 'alice')).status, 429)
})

test('une pose invalide ne déclenche pas de délai', async () => {
  assert.equal((await pose({ x: 99, y: 0, color: '#123456' }, 'carole')).status, 400)
  assert.equal((await pose({ x: 6, y: 6, color: '#123456' }, 'carole')).status, 200)
})

test('deux poses simultanées du même compte : une seule est acceptée', async () => {
  const historyBefore = await prisma.pixelPlacement.count({ where: { accountId: 'david' } })
  const responses = await Promise.all([
    pose({ x: 7, y: 7, color: '#123456' }, 'david'),
    pose({ x: 7, y: 8, color: '#123456' }, 'david'),
  ])
  assert.deepEqual(responses.map((response) => response.status).sort(), [200, 429])
  assert.equal(await prisma.pixelPlacement.count({ where: { accountId: 'david' } }), historyBefore + 1)
})

test('PIXEL_COOLDOWN_SECONDS règle le délai, 10 secondes par défaut', () => {
  assert.equal(readCooldownMs({}), 10_000)
  assert.equal(readCooldownMs({ PIXEL_COOLDOWN_SECONDS: '30' }), 30_000)
  assert.equal(readCooldownMs({ PIXEL_COOLDOWN_SECONDS: '0.5' }), 500)
  assert.equal(readCooldownMs({ PIXEL_COOLDOWN_SECONDS: '0' }), 0)
  for (const invalid of ['', '  ', 'dix', '-5', 'Infinity']) {
    assert.equal(readCooldownMs({ PIXEL_COOLDOWN_SECONDS: invalid }), 10_000, invalid)
  }
})
