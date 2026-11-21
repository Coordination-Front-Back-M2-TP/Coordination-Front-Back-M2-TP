import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { once } from 'node:events'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { after, before, test } from 'node:test'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import prismaClient from '@prisma/client'
import { io as createClient } from 'socket.io-client'
import { createAccountRepository } from '../src/accounts/account-repository.js'
import { createCanvasRepository } from '../src/canvas/canvas-repository.js'
import { createModerationRepository } from '../src/moderation/moderation-repository.js'
import { createCanvasServer } from '../src/server.js'
import { createTeamRepository } from '../src/teams/team-repository.js'

const backDirectory = fileURLToPath(new URL('../', import.meta.url))
const databasePath = join(backDirectory, 'prisma', `test-moderation-${process.pid}.db`)
const databaseUrl = `file:./prisma/test-moderation-${process.pid}.db`
const { PrismaClient } = prismaClient
// Mot de passe fictif, propre aux tests.
const PASSWORD = 'mot-de-passe-de-test'
let prisma
let server
let baseUrl
// Cookies de session : une admin, un joueur avec équipe.
let admin
let player

before(async () => {
  execFileSync(process.execPath, [join(backDirectory, 'scripts', 'prisma.js'), 'migrate', 'deploy'], {
    cwd: backDirectory,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'pipe',
  })
  prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: databaseUrl }) })
  server = createCanvasServer({
    repository: createCanvasRepository(prisma),
    accountRepository: createAccountRepository(prisma),
    teamRepository: createTeamRepository(prisma),
    moderationRepository: createModerationRepository(prisma),
    cooldownMs: 0,
  })
  server.httpServer.listen(0)
  await once(server.httpServer, 'listening')
  baseUrl = `http://localhost:${server.httpServer.address().port}`

  admin = await register('Lea')
  await prisma.account.update({ where: { pseudoKey: 'lea' }, data: { role: 'admin' } })
  player = await register('Joueur')
  const joined = await request('/api/auth/me/team', { method: 'PUT', cookie: player, body: { teamId: 'rouge' } })
  assert.equal(joined.status, 200)
})

after(async () => {
  if (server) await new Promise((resolve) => server.io.close(resolve))
  if (prisma) await prisma.$disconnect()
  for (const suffix of ['', '-journal', '-shm', '-wal']) await rm(`${databasePath}${suffix}`, { force: true })
})

function request(path, { method = 'GET', body, cookie } = {}) {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(cookie ? { cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

// Crée un compte et renvoie le cookie de session à renvoyer, sous la forme « nom=valeur ».
async function register(pseudo, extra = {}) {
  const response = await request('/api/auth/register', {
    method: 'POST',
    body: { pseudo, password: PASSWORD, ...extra },
  })
  assert.equal(response.status, 201)
  return response.headers.getSetCookie().find((cookie) => cookie.startsWith('p1x3l_session=')).split(';')[0]
}

async function pose(x, y) {
  const response = await request('/api/pixels', { method: 'POST', cookie: player, body: { x, y, color: '#123456' } })
  assert.equal(response.status, 200)
  return (await response.json()).pixel
}

function clean(zone, cookie = admin) {
  return request('/api/moderation/cleanups', { method: 'POST', cookie, body: zone })
}

async function visiblePixels() {
  const snapshot = await (await request('/api/pixels')).json()
  return { revision: snapshot.revision, cells: snapshot.pixels.map(({ x, y }) => `${x},${y}`).sort() }
}

test('le rôle revient avec le joueur connecté : player par défaut, admin après promotion', async () => {
  const me = await (await request('/api/auth/me', { cookie: player })).json()
  assert.equal(me.user.role, 'player')
  const lea = await (await request('/api/auth/me', { cookie: admin })).json()
  assert.deepEqual(lea.user, { pseudo: 'Lea', team: null, role: 'admin' })
})

test('un rôle envoyé à l’inscription est ignoré', async () => {
  const cookie = await register('Malin', { role: 'admin', isAdmin: true })
  const me = await (await request('/api/auth/me', { cookie })).json()
  assert.equal(me.user.role, 'player')
  assert.equal((await clean({ fromX: 0, fromY: 0, toX: 0, toY: 0 }, cookie)).status, 403)
})

test('sans session : 401 ; avec un compte joueur : 403 ; rien n’est effacé ni noté', async () => {
  await pose(40, 40)
  const actionsBefore = await prisma.moderationAction.count()
  const zone = { fromX: 40, fromY: 40, toX: 40, toY: 40 }

  // null, et non undefined : clean() prendrait le cookie admin par défaut.
  const cases = [
    [null, 401, 'UNAUTHORIZED'],
    ['p1x3l_session=inconnu', 401, 'UNAUTHORIZED'],
    [player, 403, 'FORBIDDEN'],
  ]
  for (const [cookie, status, code] of cases) {
    for (const response of [await clean(zone, cookie), await request('/api/moderation/actions', { cookie })]) {
      assert.equal(response.status, status)
      assert.equal((await response.json()).error.code, code)
    }
  }
  assert.equal(await prisma.pixel.count({ where: { x: 40, y: 40 } }), 1)
  assert.equal(await prisma.moderationAction.count(), actionsBefore)
})

test('une admin nettoie une zone : ses pixels disparaissent, les autres restent, l’historique est gardé', async () => {
  for (const [x, y] of [[0, 0], [1, 0], [2, 1], [3, 0], [0, 2]]) await pose(x, y)
  const placementsBefore = await prisma.pixelPlacement.count()
  const before = await visiblePixels()

  const response = await clean({ fromX: 0, fromY: 0, toX: 2, toY: 1 })
  assert.equal(response.status, 200)
  const { action } = await response.json()
  assert.deepEqual(Object.keys(action).sort(), ['admin', 'createdAt', 'details', 'id', 'type'])
  assert.equal(action.type, 'zone_cleanup')
  assert.equal(action.admin, 'Lea')
  assert.equal(Number.isFinite(Date.parse(action.createdAt)), true)
  assert.deepEqual(action.details, {
    fromX: 0,
    fromY: 0,
    toX: 2,
    toY: 1,
    removedCount: 3,
    revision: before.revision + 1,
  })

  const afterCleanup = await visiblePixels()
  assert.equal(afterCleanup.revision, action.details.revision)
  for (const cell of ['0,0', '1,0', '2,1']) assert.equal(afterCleanup.cells.includes(cell), false, cell)
  // (3, 0) et (0, 2) touchent la zone sans y être.
  for (const cell of ['3,0', '0,2', '40,40']) assert.equal(afterCleanup.cells.includes(cell), true, cell)
  assert.equal(await prisma.pixelPlacement.count(), placementsBefore)
})

test('la zone nettoyée est diffusée en direct aux abonnés de la toile', async (t) => {
  await pose(10, 10)
  const socket = createClient(baseUrl)
  t.after(() => socket.disconnect())
  await once(socket, 'connect')
  await socket.timeout(1000).emitWithAck('canvas:subscribe')
  const cleared = once(socket, 'canvas:cleared')

  const { action } = await (await clean({ fromX: 10, fromY: 10, toX: 12, toY: 12 })).json()
  const [payload] = await cleared
  assert.deepEqual(payload, {
    fromX: 10,
    fromY: 10,
    toX: 12,
    toY: 12,
    revision: action.details.revision,
    clearedAt: action.createdAt,
  })
})

test('une pose faite après le nettoyage reste visible', async () => {
  await clean({ fromX: 20, fromY: 20, toX: 22, toY: 22 })
  const pixel = await pose(21, 21)
  const { cells, revision } = await visiblePixels()
  assert.equal(cells.includes('21,21'), true)
  assert.equal(revision, pixel.revision)
})

test('une zone vide est quand même notée dans le journal', async () => {
  const actionsBefore = await prisma.moderationAction.count()
  const { action } = await (await clean({ fromX: -50, fromY: -50, toX: -45, toY: -45 })).json()
  assert.equal(action.details.removedCount, 0)
  assert.equal(await prisma.moderationAction.count(), actionsBefore + 1)
})

test('une zone peut être une seule case, ou toute la toile', async () => {
  await pose(-125, 124)
  await pose(124, -125)
  const single = await (await clean({ fromX: -125, fromY: 124, toX: -125, toY: 124 })).json()
  assert.equal(single.action.details.removedCount, 1)

  const whole = await clean({ fromX: -125, fromY: -125, toX: 124, toY: 124 })
  assert.equal(whole.status, 200)
  assert.deepEqual((await visiblePixels()).cells, [])
})

test('refuse en 400 INVALID_INPUT une zone hors contrat, sans rien noter', async () => {
  const actionsBefore = await prisma.moderationAction.count()
  const invalid = [
    {},
    [],
    { fromX: 0, fromY: 0, toX: 1 },
    { fromX: 2, fromY: 0, toX: 1, toY: 1 },
    { fromX: 0, fromY: 2, toX: 1, toY: 1 },
    { fromX: -126, fromY: 0, toX: 1, toY: 1 },
    { fromX: 0, fromY: 0, toX: 125, toY: 1 },
    { fromX: 0.5, fromY: 0, toX: 1, toY: 1 },
    { fromX: '0', fromY: 0, toX: 1, toY: 1 },
  ]
  for (const zone of invalid) {
    const response = await clean(zone)
    assert.equal(response.status, 400, JSON.stringify(zone))
    assert.equal((await response.json()).error.code, 'INVALID_INPUT')
  }
  assert.equal(await prisma.moderationAction.count(), actionsBefore)
})

test('le journal liste les actions, la plus récente d’abord, sans identifiant de compte', async () => {
  const response = await request('/api/moderation/actions', { cookie: admin })
  assert.equal(response.status, 200)
  const { actions, nextCursor } = await response.json()
  assert.equal(nextCursor, null)
  assert.equal(actions.length, await prisma.moderationAction.count())
  const ids = actions.map((action) => action.id)
  assert.deepEqual(ids, [...ids].sort((a, b) => b - a))
  for (const action of actions) {
    assert.deepEqual(Object.keys(action).sort(), ['admin', 'createdAt', 'details', 'id', 'type'])
    assert.equal(action.admin, 'Lea')
    assert.equal(action.type, 'zone_cleanup')
  }
})

test('limit et before parcourent le journal page par page, sans trou ni doublon', async () => {
  const total = await prisma.moderationAction.count()
  assert.equal(total >= 5, true)
  const seen = []
  let query = '?limit=2'
  while (query) {
    const response = await request(`/api/moderation/actions${query}`, { cookie: admin })
    assert.equal(response.status, 200)
    const { actions, nextCursor } = await response.json()
    assert.equal(actions.length <= 2, true)
    seen.push(...actions.map((action) => action.id))
    query = nextCursor === null ? null : `?limit=2&before=${nextCursor}`
  }
  assert.equal(seen.length, total)
  assert.equal(new Set(seen).size, total)
  assert.deepEqual(seen, [...seen].sort((a, b) => b - a))
})

test('refuse en 400 INVALID_INPUT une page du journal hors contrat', async () => {
  for (const query of ['?limit=0', '?limit=201', '?limit=abc', '?before=0', '?before=-1', '?limit=1&limit=2']) {
    const response = await request(`/api/moderation/actions${query}`, { cookie: admin })
    assert.equal(response.status, 400, query)
    assert.equal((await response.json()).error.code, 'INVALID_INPUT')
  }
})

test('une admin à qui on retire le rôle perd l’accès tout de suite, sans se reconnecter', async () => {
  const cookie = await register('Ancienne')
  await prisma.account.update({ where: { pseudoKey: 'ancienne' }, data: { role: 'admin' } })
  assert.equal((await request('/api/moderation/actions', { cookie })).status, 200)

  await prisma.account.update({ where: { pseudoKey: 'ancienne' }, data: { role: 'player' } })
  assert.equal((await request('/api/moderation/actions', { cookie })).status, 403)
})

test('le script set-role donne et retire le rôle admin à un compte existant', async () => {
  await register('Promue')
  function setRole(...args) {
    return spawnSync(process.execPath, [join(backDirectory, 'scripts', 'set-role.js'), ...args], {
      cwd: backDirectory,
      env: { ...process.env, DATABASE_URL: databaseUrl },
      encoding: 'utf8',
    })
  }
  async function roleOf(pseudoKey) {
    return (await prisma.account.findUnique({ where: { pseudoKey } })).role
  }

  assert.equal(setRole('PROMUE', 'admin').status, 0)
  assert.equal(await roleOf('promue'), 'admin')
  assert.equal(setRole('Promue', 'player').status, 0)
  assert.equal(await roleOf('promue'), 'player')

  // Un pseudo inconnu ne crée pas de compte ; un rôle inconnu ou absent est refusé.
  assert.equal(setRole('Personne', 'admin').status, 1)
  assert.equal(await prisma.account.count({ where: { pseudoKey: 'personne' } }), 0)
  assert.equal(setRole('Promue', 'superadmin').status, 1)
  assert.equal(setRole('Promue').status, 1)
  assert.equal(await roleOf('promue'), 'player')
})
