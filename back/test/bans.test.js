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
import { createAccountRepository } from '../src/accounts/account-repository.js'
import { createCanvasRepository } from '../src/canvas/canvas-repository.js'
import { createModerationRepository } from '../src/moderation/moderation-repository.js'
import { createCanvasServer } from '../src/server.js'
import { createTeamRepository } from '../src/teams/team-repository.js'

const backDirectory = fileURLToPath(new URL('../', import.meta.url))
const databasePath = join(backDirectory, 'prisma', `test-bans-${process.pid}.db`)
const databaseUrl = `file:./prisma/test-bans-${process.pid}.db`
const { PrismaClient } = prismaClient
// Mot de passe fictif, propre aux tests.
const PASSWORD = 'mot-de-passe-de-test'
let prisma
let server
let baseUrl
// Cookie de session de l'admin.
let admin

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
async function register(pseudo) {
  const response = await request('/api/auth/register', { method: 'POST', body: { pseudo, password: PASSWORD } })
  assert.equal(response.status, 201)
  return response.headers.getSetCookie().find((cookie) => cookie.startsWith('p1x3l_session=')).split(';')[0]
}

// Crée un joueur prêt à poser : un compte et une équipe.
async function createPlayer(pseudo, teamId = 'rouge') {
  const cookie = await register(pseudo)
  const joined = await request('/api/auth/me/team', { method: 'PUT', cookie, body: { teamId } })
  assert.equal(joined.status, 200)
  return cookie
}

function tryPose(cookie, x, y, color) {
  return request('/api/pixels', { method: 'POST', cookie, body: { x, y, color } })
}

async function pose(cookie, x, y, color) {
  const response = await tryPose(cookie, x, y, color)
  assert.equal(response.status, 200)
  return (await response.json()).pixel
}

function ban(pseudo, cookie = admin) {
  return request('/api/moderation/bans', { method: 'POST', cookie, body: { pseudo } })
}

async function banned(pseudo) {
  const response = await ban(pseudo)
  assert.equal(response.status, 200)
  return (await response.json()).action
}

// Le pixel visible d'une case, ou undefined si elle est vide.
async function pixelAt(x, y) {
  const snapshot = await (await request('/api/pixels')).json()
  return snapshot.pixels.find((pixel) => pixel.x === x && pixel.y === y)
}

test('sans session : 401 ; avec un compte joueur : 403 ; personne n’est banni', async () => {
  const player = await createPlayer('Curieux')
  await createPlayer('Cible')
  const actionsBefore = await prisma.moderationAction.count()

  // null, et non undefined : ban() prendrait le cookie admin par défaut.
  const cases = [
    [null, 401, 'UNAUTHORIZED'],
    ['p1x3l_session=inconnu', 401, 'UNAUTHORIZED'],
    [player, 403, 'FORBIDDEN'],
  ]
  for (const [cookie, status, code] of cases) {
    for (const response of [await ban('Cible', cookie), await request('/api/moderation/players', { cookie })]) {
      assert.equal(response.status, status)
      assert.equal((await response.json()).error.code, code)
    }
  }
  assert.equal(await prisma.account.count({ where: { bannedAt: { not: null } } }), 0)
  assert.equal(await prisma.moderationAction.count(), actionsBefore)
})

test('les pixels du joueur banni sont remplacés par ceux d’avant lui, d’après l’historique', async () => {
  const alice = await createPlayer('Alice', 'bleue')
  const troll = await createPlayer('Troll')
  const before = await pose(alice, 0, 0, '#0000AA')
  await pose(alice, 2, 0, '#0000AA')
  await pose(troll, 0, 0, '#FF0000')
  await pose(troll, 1, 0, '#FF0000')
  // Alice repasse sur une case du troll : ce pixel n'est plus à lui.
  await pose(troll, 3, 0, '#FF0000')
  const over = await pose(alice, 3, 0, '#00AA00')
  const placementsBefore = await prisma.pixelPlacement.count()
  const revisionBefore = (await (await request('/api/pixels')).json()).revision

  const action = await banned('troll')
  assert.deepEqual(Object.keys(action).sort(), ['admin', 'createdAt', 'details', 'id', 'type'])
  assert.equal(action.type, 'player_ban')
  assert.equal(action.admin, 'Lea')
  assert.deepEqual(action.details, { pseudo: 'Troll', restoredCount: 1, clearedCount: 1, revision: revisionBefore + 1 })

  // (0, 0) reprend le pixel d'Alice tel qu'il était ; (1, 0), sans pixel d'avant, redevient vide.
  assert.deepEqual(await pixelAt(0, 0), before)
  assert.equal(await pixelAt(1, 0), undefined)
  assert.equal((await pixelAt(2, 0)).color, '#0000AA')
  assert.deepEqual(await pixelAt(3, 0), over)
  // L'historique n'est pas réécrit, et l'action est dans le journal.
  assert.equal(await prisma.pixelPlacement.count(), placementsBefore)
  const journal = await (await request('/api/moderation/actions?limit=1', { cookie: admin })).json()
  assert.deepEqual(journal.actions, [action])
})

test('un joueur banni ne peut plus poser : 403 ACCOUNT_BANNED, rien n’est écrit', async () => {
  const cookie = await createPlayer('Script')
  await pose(cookie, 10, 10, '#FF0000')
  await banned('Script')
  const placementsBefore = await prisma.pixelPlacement.count()
  const revisionBefore = (await (await request('/api/pixels')).json()).revision

  const response = await tryPose(cookie, 10, 10, '#FF0000')
  assert.equal(response.status, 403)
  assert.equal((await response.json()).error.code, 'ACCOUNT_BANNED')
  assert.equal(await pixelAt(10, 10), undefined)
  assert.equal(await prisma.pixelPlacement.count(), placementsBefore)
  assert.equal((await (await request('/api/pixels')).json()).revision, revisionBefore)
})

test('les cases changées sont diffusées en direct, sans le pseudo du joueur banni', async (t) => {
  const alice = await createPlayer('Alix')
  const troll = await createPlayer('Vandale')
  const before = await pose(alice, 20, 20, '#0000AA')
  await pose(troll, 20, 20, '#FF0000')
  await pose(troll, 21, 20, '#FF0000')
  const socket = createClient(baseUrl)
  t.after(() => socket.disconnect())
  await once(socket, 'connect')
  await socket.timeout(1000).emitWithAck('canvas:subscribe')
  const reverted = once(socket, 'canvas:reverted')

  const action = await banned('Vandale')
  const [payload] = await reverted
  assert.deepEqual(payload, {
    revision: action.details.revision,
    revertedAt: action.createdAt,
    restored: [before],
    cleared: [{ x: 21, y: 20 }],
  })
})

test('le pixel d’avant ne vient jamais d’un autre joueur banni', async () => {
  const honest = await createPlayer('Honnete')
  const first = await createPlayer('Premier')
  const second = await createPlayer('Second')
  const before = await pose(honest, 30, 30, '#0000AA')
  await pose(first, 30, 30, '#FF0000')
  await pose(second, 30, 30, '#AA00AA')

  // Premier n'a plus de pixel visible : son bannissement ne change pas la toile.
  const firstBan = await banned('Premier')
  assert.deepEqual([firstBan.details.restoredCount, firstBan.details.clearedCount], [0, 0])
  assert.equal((await pixelAt(30, 30)).color, '#AA00AA')

  await banned('Second')
  assert.deepEqual(await pixelAt(30, 30), before)
})

test('une case nettoyée avant la pose du joueur banni redevient vide', async () => {
  const honest = await createPlayer('Ancien')
  const troll = await createPlayer('Nouveau')
  await pose(honest, 40, 40, '#0000AA')
  const cleaned = await request('/api/moderation/cleanups', {
    method: 'POST',
    cookie: admin,
    body: { fromX: 40, fromY: 40, toX: 40, toY: 40 },
  })
  assert.equal(cleaned.status, 200)
  await pose(troll, 40, 40, '#FF0000')

  const action = await banned('Nouveau')
  assert.deepEqual([action.details.restoredCount, action.details.clearedCount], [0, 1])
  assert.equal(await pixelAt(40, 40), undefined)
})

test('un pixel remis reste celui de son joueur : le bannir ensuite le retire', async () => {
  const owner = await createPlayer('Remis')
  const troll = await createPlayer('Passant')
  await pose(owner, -10, -10, '#0000AA')
  await pose(troll, -10, -10, '#FF0000')
  await banned('Passant')
  assert.equal((await pixelAt(-10, -10)).color, '#0000AA')

  const action = await banned('Remis')
  assert.deepEqual([action.details.restoredCount, action.details.clearedCount], [0, 1])
  assert.equal(await pixelAt(-10, -10), undefined)
})

test('refuse un pseudo hors contrat, inconnu, déjà banni ou admin, sans rien noter', async () => {
  await createPlayer('Recidive')
  await banned('Recidive')
  const actionsBefore = await prisma.moderationAction.count()
  const revisionBefore = (await (await request('/api/pixels')).json()).revision

  for (const body of [undefined, {}, { pseudo: 12 }, { pseudo: '   ' }, { pseudo: 'x'.repeat(65) }, { pseudo: ['Lea'] }]) {
    const response = await request('/api/moderation/bans', { method: 'POST', cookie: admin, body })
    assert.equal(response.status, 400, JSON.stringify(body))
    assert.equal((await response.json()).error.code, 'INVALID_INPUT')
  }
  const cases = [
    ['Personne', 404, 'PLAYER_NOT_FOUND'],
    ['recidive', 409, 'ALREADY_BANNED'],
    ['Lea', 409, 'ADMIN_NOT_BANNABLE'],
  ]
  for (const [pseudo, status, code] of cases) {
    const response = await ban(pseudo)
    assert.equal(response.status, status, pseudo)
    assert.equal((await response.json()).error.code, code)
  }
  assert.equal(await prisma.moderationAction.count(), actionsBefore)
  assert.equal((await (await request('/api/pixels')).json()).revision, revisionBefore)
})

test('la liste des joueurs dit qui est banni, sans identifiant ni mot de passe', async () => {
  const response = await request('/api/moderation/players?limit=200', { cookie: admin })
  assert.equal(response.status, 200)
  const { players, nextCursor } = await response.json()
  assert.equal(nextCursor, null)
  assert.equal(players.length, await prisma.account.count())
  for (const player of players) {
    assert.deepEqual(Object.keys(player).sort(), ['banned', 'bannedAt', 'pseudo', 'role', 'team'])
  }
  // Dans l'ordre des pseudos, sans tenir compte de la casse.
  const keys = players.map(({ pseudo }) => pseudo.toLowerCase())
  assert.deepEqual(keys, [...keys].sort())

  const lea = players.find(({ pseudo }) => pseudo === 'Lea')
  assert.deepEqual(lea, { pseudo: 'Lea', team: null, role: 'admin', banned: false, bannedAt: null })
  const troll = players.find(({ pseudo }) => pseudo === 'Troll')
  assert.equal(troll.banned, true)
  assert.equal(troll.team.id, 'rouge')
  assert.equal(new Date(troll.bannedAt).toISOString(), troll.bannedAt)
  assert.equal(players.find(({ pseudo }) => pseudo === 'Alice').banned, false)
})

test('limit et after parcourent la liste des joueurs page par page, sans trou ni doublon', async () => {
  const all = (await (await request('/api/moderation/players?limit=200', { cookie: admin })).json()).players
  const seen = []
  let cursor = null
  do {
    const query = cursor === null ? '?limit=4' : `?limit=4&after=${encodeURIComponent(cursor)}`
    const page = await (await request(`/api/moderation/players${query}`, { cookie: admin })).json()
    assert.ok(page.players.length <= 4)
    seen.push(...page.players)
    cursor = page.nextCursor
  } while (cursor !== null)
  assert.deepEqual(seen, all)

  for (const query of ['?limit=0', '?limit=201', '?limit=abc', '?after=', '?after=a&after=b']) {
    const response = await request(`/api/moderation/players${query}`, { cookie: admin })
    assert.equal(response.status, 400, query)
    assert.equal((await response.json()).error.code, 'INVALID_INPUT')
  }
})
