import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { once } from 'node:events'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { after, before, test } from 'node:test'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import prismaClient from '@prisma/client'
import { createAccountRepository } from '../src/accounts/account-repository.js'
import { createCanvasRepository } from '../src/canvas/canvas-repository.js'
import { createCanvasServer } from '../src/server.js'
import { createRankingRepository } from '../src/rankings/ranking-repository.js'
import { createTeamRepository } from '../src/teams/team-repository.js'
import { createTeamService, readTeamChangeCooldownMs } from '../src/teams/team-service.js'

const backDirectory = fileURLToPath(new URL('../', import.meta.url))
const databasePath = join(backDirectory, 'prisma', `test-teams-${process.pid}.db`)
const databaseUrl = `file:./prisma/test-teams-${process.pid}.db`
const { PrismaClient } = prismaClient
// Mot de passe fictif, propre aux tests.
const PASSWORD = 'mot-de-passe-de-test'
const TEAM_CHANGE_COOLDOWN_MS = 5 * 60 * 1000
const ROUGE = { id: 'rouge', name: 'Rouge', color: '#D93A3A' }
const BLEUE = { id: 'bleue', name: 'Bleue', color: '#2F6FDE' }
let prisma
let server
let baseUrl
let canvasRepository

before(async () => {
  execFileSync(process.execPath, [join(backDirectory, 'scripts', 'prisma.js'), 'migrate', 'deploy'], {
    cwd: backDirectory,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'pipe',
  })
  prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: databaseUrl }) })
  canvasRepository = createCanvasRepository(prisma)
  server = createCanvasServer({
    repository: canvasRepository,
    accountRepository: createAccountRepository(prisma),
    teamRepository: createTeamRepository(prisma),
    rankingRepository: createRankingRepository(prisma),
    teamChangeCooldownMs: TEAM_CHANGE_COOLDOWN_MS,
    cooldownMs: 0,
  })
  server.httpServer.listen(0)
  await once(server.httpServer, 'listening')
  baseUrl = `http://localhost:${server.httpServer.address().port}`
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

function joinTeam(cookie, teamId) {
  return request('/api/auth/me/team', { method: 'PUT', cookie, body: { teamId } })
}

// Recule le dernier changement d'équipe du compte, comme si le temps avait passé.
async function rewindTeamChange(pseudo, milliseconds) {
  const account = await prisma.account.findUnique({ where: { pseudoKey: pseudo.toLowerCase() } })
  await prisma.account.update({
    where: { id: account.id },
    data: { teamChangedAt: new Date(account.teamChangedAt.getTime() - milliseconds) },
  })
}

test('GET /api/teams liste les 4 équipes, sans compte', async () => {
  const response = await request('/api/teams')
  assert.equal(response.status, 200)
  const { teams } = await response.json()
  assert.equal(teams.length, 4)
  assert.deepEqual(teams.slice(0, 2), [ROUGE, BLEUE])
  assert.equal(new Set(teams.map((team) => team.id)).size, 4)
  for (const team of teams) {
    assert.deepEqual(Object.keys(team).sort(), ['color', 'id', 'name'])
    assert.match(team.color, /^#[0-9A-F]{6}$/)
  }
})

test('un nouveau joueur n’a pas d’équipe, puis son premier choix passe sans attendre', async () => {
  const cookie = await register('Nouveau')
  const me = await request('/api/auth/me', { cookie })
  assert.deepEqual(await me.json(), { user: { pseudo: 'Nouveau', team: null, role: 'player' } })

  const startedAt = Date.now()
  const response = await joinTeam(cookie, 'rouge')
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.deepEqual(Object.keys(body).sort(), ['teamChangeAvailableAt', 'user'])
  assert.deepEqual(body.user, { pseudo: 'Nouveau', team: ROUGE, role: 'player' })
  const availableAt = Date.parse(body.teamChangeAvailableAt)
  assert.equal(availableAt >= startedAt + TEAM_CHANGE_COOLDOWN_MS - 1000, true)
  assert.equal(availableAt <= Date.now() + TEAM_CHANGE_COOLDOWN_MS, true)

  // L'équipe s'affiche à côté du pseudo : elle revient avec le joueur connecté, après rechargement.
  const reloaded = await request('/api/auth/me', { cookie })
  assert.deepEqual(await reloaded.json(), { user: { pseudo: 'Nouveau', team: ROUGE, role: 'player' } })
})

test('changer d’équipe avant 5 minutes est refusé en 429, avec Retry-After', async () => {
  const cookie = await register('Presse')
  assert.equal((await joinTeam(cookie, 'rouge')).status, 200)

  const response = await joinTeam(cookie, 'bleue')
  assert.equal(response.status, 429)
  assert.equal((await response.json()).error.code, 'TEAM_CHANGE_COOLDOWN')
  const retryAfter = Number(response.headers.get('retry-after'))
  assert.equal(Number.isInteger(retryAfter) && retryAfter > 290 && retryAfter <= 300, true)

  // Le refus ne change rien : le joueur garde son équipe.
  const me = await request('/api/auth/me', { cookie })
  assert.deepEqual((await me.json()).user.team, ROUGE)
})

test('une fois les 5 minutes passées, le changement d’équipe passe et relance le délai', async () => {
  const cookie = await register('Patient')
  assert.equal((await joinTeam(cookie, 'rouge')).status, 200)

  await rewindTeamChange('Patient', TEAM_CHANGE_COOLDOWN_MS - 2000)
  assert.equal((await joinTeam(cookie, 'bleue')).status, 429)

  await rewindTeamChange('Patient', 2000)
  const response = await joinTeam(cookie, 'bleue')
  assert.equal(response.status, 200)
  assert.deepEqual((await response.json()).user.team, BLEUE)

  assert.equal((await joinTeam(cookie, 'rouge')).status, 429)
})

test('redemander son équipe répond 200 sans relancer le délai', async () => {
  const cookie = await register('Fidele')
  const first = await (await joinTeam(cookie, 'verte')).json()

  const again = await joinTeam(cookie, 'verte')
  assert.equal(again.status, 200)
  const body = await again.json()
  assert.equal(body.user.team.id, 'verte')
  assert.equal(body.teamChangeAvailableAt, first.teamChangeAvailableAt)
})

test('deux changements simultanés : un seul passe', async () => {
  const cookie = await register('Double')
  assert.equal((await joinTeam(cookie, 'rouge')).status, 200)
  await rewindTeamChange('Double', TEAM_CHANGE_COOLDOWN_MS)

  const responses = await Promise.all([joinTeam(cookie, 'bleue'), joinTeam(cookie, 'verte')])
  assert.deepEqual(responses.map((response) => response.status).sort(), [200, 429])
})

test('le délai est propre à chaque joueur', async () => {
  const first = await register('Premier')
  const second = await register('Second')
  assert.equal((await joinTeam(first, 'rouge')).status, 200)
  assert.equal((await joinTeam(second, 'bleue')).status, 200)
  assert.equal((await joinTeam(first, 'bleue')).status, 429)
})

test('sans session, choisir une équipe est refusé en 401', async () => {
  for (const cookie of [undefined, 'p1x3l_session=inconnu']) {
    const response = await joinTeam(cookie, 'rouge')
    assert.equal(response.status, 401)
    assert.equal((await response.json()).error.code, 'UNAUTHORIZED')
  }
})

test('une équipe inconnue est refusée en 404, une requête mal formée en 400', async () => {
  const cookie = await register('Perdu')

  const unknown = await joinTeam(cookie, 'violette')
  assert.equal(unknown.status, 404)
  assert.equal((await unknown.json()).error.code, 'TEAM_NOT_FOUND')

  for (const body of [{}, [], { teamId: 1 }, { teamId: null }, { team: 'rouge' }]) {
    const response = await request('/api/auth/me/team', { method: 'PUT', cookie, body })
    assert.equal(response.status, 400, JSON.stringify(body))
    assert.equal((await response.json()).error.code, 'INVALID_INPUT')
  }

  // Aucun de ces refus ne lance le délai : le premier vrai choix passe.
  assert.equal((await joinTeam(cookie, 'jaune')).status, 200)
})

test('sans équipe, la pose est refusée en 403 TEAM_REQUIRED et rien n’est écrit', async () => {
  const cookie = await register('Hesitant')
  const before = await prisma.pixelPlacement.count()

  const response = await request('/api/pixels', { method: 'POST', cookie, body: { x: 1, y: 1, color: '#123456' } })
  assert.equal(response.status, 403)
  assert.equal((await response.json()).error.code, 'TEAM_REQUIRED')
  assert.equal(await prisma.pixelPlacement.count(), before)
  assert.equal(await prisma.pixel.count({ where: { x: 1, y: 1 } }), 0)
})

test('mes pixels comptent pour mon équipe, et restent à l’équipe du moment de la pose', async () => {
  const cookie = await register('Peintre')
  assert.equal((await joinTeam(cookie, 'rouge')).status, 200)
  const first = await request('/api/pixels', { method: 'POST', cookie, body: { x: 2, y: 2, color: '#123456' } })
  assert.equal(first.status, 200)

  await rewindTeamChange('Peintre', TEAM_CHANGE_COOLDOWN_MS)
  assert.equal((await joinTeam(cookie, 'bleue')).status, 200)
  const second = await request('/api/pixels', { method: 'POST', cookie, body: { x: 3, y: 2, color: '#123456' } })
  assert.equal(second.status, 200)

  const revisions = [(await first.json()).pixel.revision, (await second.json()).pixel.revision]
  const placements = await prisma.pixelPlacement.findMany({
    where: { revision: { in: revisions } },
    orderBy: { revision: 'asc' },
  })
  assert.deepEqual(placements.map((placement) => placement.teamId), ['rouge', 'bleue'])
})

test('le délai suit l’horloge du serveur et TEAM_CHANGE_COOLDOWN_SECONDS', async () => {
  await register('Horloge')
  const account = await prisma.account.findUnique({ where: { pseudoKey: 'horloge' } })
  let clock = new Date('2026-11-01T10:00:00.000Z')
  const service = createTeamService({
    repository: createTeamRepository(prisma),
    now: () => clock,
    cooldownMs: 60_000,
  })

  const joined = await service.joinTeam(account, { teamId: 'rouge' })
  assert.equal(joined.teamChangeAvailableAt.toISOString(), '2026-11-01T10:01:00.000Z')

  clock = new Date('2026-11-01T10:00:30.500Z')
  await assert.rejects(service.joinTeam(joined.account, { teamId: 'bleue' }), (error) => {
    assert.equal(error.code, 'TEAM_CHANGE_COOLDOWN')
    // 29,5 secondes restantes, arrondies au-dessus.
    assert.equal(error.headers['Retry-After'], '30')
    return true
  })

  clock = new Date('2026-11-01T10:01:00.000Z')
  assert.equal((await service.joinTeam(joined.account, { teamId: 'bleue' })).account.teamId, 'bleue')

  assert.equal(readTeamChangeCooldownMs({}), 300_000)
  assert.equal(readTeamChangeCooldownMs({ TEAM_CHANGE_COOLDOWN_SECONDS: '60' }), 60_000)
  assert.equal(readTeamChangeCooldownMs({ TEAM_CHANGE_COOLDOWN_SECONDS: '0' }), 0)
  for (const value of ['', '-5', 'abc']) {
    assert.equal(readTeamChangeCooldownMs({ TEAM_CHANGE_COOLDOWN_SECONDS: value }), 300_000, value)
  }
})

function createTeam(cookie, name, color = '#9333EA') {
  return request('/api/teams', { method: 'POST', cookie, body: { name, color } })
}

test('une équipe créée est persistée, rejoint son joueur et apparaît au classement après son premier pixel', async () => {
  const cookie = await register('Createur')
  const response = await createTeam(cookie, '  Les Éclairs  ', '#9333ea')
  assert.equal(response.status, 201)
  const body = await response.json()
  const team = { id: 'les-eclairs', name: 'Les Éclairs', color: '#9333EA' }
  assert.deepEqual(body.team, team)
  assert.deepEqual(body.user.team, team)
  assert.equal((await (await request('/api/auth/me', { cookie })).json()).user.team.id, team.id)
  assert.deepEqual((await (await request('/api/teams')).json()).teams.at(-1), team)
  assert.equal((await createTeam(cookie, 'Trop vite')).status, 429)
  assert.equal(await prisma.team.count({ where: { id: 'trop-vite' } }), 0)
  const pixel = await request('/api/pixels', { method: 'POST', cookie, body: { x: 41, y: 41, color: '#123456' } })
  assert.equal(pixel.status, 200)
  const ranking = await (await request('/api/rankings')).json()
  assert.equal(ranking.teams.find((entry) => entry.teamId === team.id).pixelCount, 1)
  await rewindTeamChange('Createur', TEAM_CHANGE_COOLDOWN_MS)
  assert.equal((await joinTeam(cookie, 'rouge')).status, 200)
  assert.ok((await (await request('/api/teams')).json()).teams.some((item) => item.id === team.id))
})

test('validation, session, bannissement et conflits ne créent rien', async () => {
  assert.equal((await createTeam(undefined, 'Sans compte')).status, 401)
  const cookie = await register('Validateur')
  for (const [name, color] of [['ab', '#9333EA'], ['a'.repeat(21), '#9333EA'], ['nom!', '#9333EA'], ['Valide', '#123456'], [null, '#9333EA']]) {
    const response = await createTeam(cookie, name, color)
    assert.equal(response.status, 400)
    assert.equal((await response.json()).error.code, 'INVALID_INPUT')
  }
  const duplicate = await createTeam(cookie, 'les eclairs')
  assert.equal(duplicate.status, 409)
  assert.equal((await duplicate.json()).error.code, 'TEAM_NAME_TAKEN')
  assert.equal((await (await request('/api/auth/me', { cookie })).json()).user.team, null)
  await prisma.account.update({ where: { pseudoKey: 'validateur' }, data: { bannedAt: new Date() } })
  const banned = await createTeam(cookie, 'Interdite')
  assert.equal(banned.status, 403)
  assert.equal((await banned.json()).error.code, 'ACCOUNT_BANNED')
  assert.equal(await prisma.team.count({ where: { id: 'interdite' } }), 0)
})

test('deux créations simultanées de même nom ne créent qu’une équipe', async () => {
  const first = await register('Concurrent1')
  const second = await register('Concurrent2')
  const responses = await Promise.all([createTeam(first, 'Même nom'), createTeam(second, 'meme nom')])
  assert.deepEqual(responses.map((response) => response.status).sort(), [201, 409])
  assert.equal(await prisma.team.count({ where: { id: 'meme-nom' } }), 1)
  const users = await Promise.all([first, second].map(async (cookie) => (await (await request('/api/auth/me', { cookie })).json()).user))
  assert.equal(users.filter((user) => user.team?.id === 'meme-nom').length, 1)
})

test('plusieurs équipes partagent une couleur et un autre joueur rejoint une équipe créée', async () => {
  const creator = await register('AutreCreateur')
  assert.equal((await createTeam(creator, 'Autre équipe', '#9333EA')).status, 201)
  const player = await register('Rejoignant')
  const result = await joinTeam(player, 'autre-equipe')
  assert.equal(result.status, 200)
  assert.equal((await result.json()).user.team.name, 'Autre équipe')
  assert.equal((await (await request('/api/teams')).json()).teams.filter((team) => team.color === '#9333EA').length, 3)
})

test('une pose en cours est attribuée à l’équipe effective quand elle est enregistrée', async (t) => {
  const cookie = await register('CoursePose')
  assert.equal((await joinTeam(cookie, 'rouge')).status, 200)
  const first = await request('/api/pixels', {
    method: 'POST', cookie, body: { x: 34, y: -35, color: '#FACC15' },
  })
  assert.equal(first.status, 200)
  const { pixel: firstPixel } = await first.json()
  await rewindTeamChange('CoursePose', TEAM_CHANGE_COOLDOWN_MS)

  const savePixel = canvasRepository.savePixel
  // Le changement d'équipe arrive après la lecture de la session, avant le verrou de la pose.
  const intercepted = t.mock.method(canvasRepository, 'savePixel', async (pixel, placement, options) => {
    assert.equal(placement.teamId, 'rouge')
    assert.equal((await joinTeam(cookie, 'bleue')).status, 200)
    return savePixel(pixel, placement, options)
  }, { times: 1 })

  const second = await request('/api/pixels', {
    method: 'POST', cookie, body: { x: 35, y: -35, color: '#FACC15' },
  })
  assert.equal(second.status, 200)
  assert.equal(intercepted.mock.callCount(), 1)
  const { pixel: secondPixel } = await second.json()
  const account = await prisma.account.findUniqueOrThrow({ where: { pseudoKey: 'coursepose' } })
  const history = await prisma.pixelPlacement.findMany({
    where: { accountId: String(account.id) }, orderBy: { revision: 'asc' },
  })
  assert.deepEqual(history.map(({ teamId, placedAt, revision }) => [teamId, placedAt.toISOString(), revision]), [
    ['rouge', firstPixel.updatedAt, firstPixel.revision],
    ['bleue', secondPixel.updatedAt, secondPixel.revision],
  ])
})
