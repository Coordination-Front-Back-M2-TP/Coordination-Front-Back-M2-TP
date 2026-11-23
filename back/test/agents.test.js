import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { once } from 'node:events'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { after, before, test } from 'node:test'
import { setTimeout as sleep } from 'node:timers/promises'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import prismaClient from '@prisma/client'
import { createAccountRepository } from '../src/accounts/account-repository.js'
import { createAgentRepository } from '../src/agents/agent-repository.js'
import { createCanvasRepository } from '../src/canvas/canvas-repository.js'
import { createModerationRepository } from '../src/moderation/moderation-repository.js'
import { createCanvasServer } from '../src/server.js'
import { createTeamRepository } from '../src/teams/team-repository.js'

const backDirectory = fileURLToPath(new URL('../', import.meta.url))
const databasePath = join(backDirectory, 'prisma', `test-agents-${process.pid}.db`)
const databaseUrl = `file:./prisma/test-agents-${process.pid}.db`
const { PrismaClient } = prismaClient
// Mot de passe fictif, propre aux tests.
const PASSWORD = 'mot-de-passe-de-test'
// Délai court entre deux poses : les agents finissent un petit modèle en moins d'une seconde.
const COOLDOWN_MS = 60
let prisma
let server
let baseUrl

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
    agentRepository: createAgentRepository(prisma),
    agentIdleCheckMs: 30,
    cooldownMs: COOLDOWN_MS,
  })
  server.httpServer.listen(0)
  await once(server.httpServer, 'listening')
  baseUrl = `http://localhost:${server.httpServer.address().port}`
})

after(async () => {
  if (server) {
    server.agentService.shutdown()
    await new Promise((resolve) => server.io.close(resolve))
  }
  // Un passage d'agent déjà commencé finit avant la fermeture de la base.
  await sleep(100)
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

function start(cookie, pixels) {
  return request('/api/agent', { method: 'POST', cookie, body: { pixels } })
}

// Lance l'agent et l'arrête à la fin du test, pour qu'il ne pose plus pendant les suivants.
async function started(t, cookie, pixels) {
  const response = await start(cookie, pixels)
  assert.equal(response.status, 201)
  t.after(() => request('/api/agent', { method: 'DELETE', cookie }))
  return (await response.json()).agent
}

async function agentOf(cookie) {
  const response = await request('/api/agent', { cookie })
  assert.equal(response.status, 200)
  return (await response.json()).agent
}

// Attend qu'une condition devienne vraie, sans dépasser deux secondes.
async function until(check, message) {
  const deadline = Date.now() + 2000
  for (;;) {
    const value = await check()
    if (value) return value
    if (Date.now() > deadline) assert.fail(`Délai dépassé : ${message}`)
    await sleep(15)
  }
}

function finished(cookie) {
  return until(async () => {
    const agent = await agentOf(cookie)
    return agent && agent.done === agent.total ? agent : null
  }, 'le modèle n’est pas fini')
}

async function colorAt(x, y) {
  const pixel = await prisma.pixel.findUnique({ where: { x_y: { x, y } } })
  return pixel ? pixel.color : null
}

// Une ligne de pixels d'une même couleur, à partir de (x, y).
function row(x, y, length, color = '#123456') {
  return Array.from({ length }, (_, index) => ({ x: x + index, y, color }))
}

test('sans session : 401 ; sans équipe : 403 TEAM_REQUIRED ; sans agent : null', async () => {
  for (const method of ['GET', 'POST', 'DELETE']) {
    const response = await request('/api/agent', { method, body: method === 'POST' ? { pixels: row(0, 0, 1) } : undefined })
    assert.equal(response.status, 401, method)
    assert.equal((await response.json()).error.code, 'UNAUTHORIZED')
  }

  const withoutTeam = await register('SansEquipe')
  const refused = await start(withoutTeam, row(0, 0, 1))
  assert.equal(refused.status, 403)
  assert.equal((await refused.json()).error.code, 'TEAM_REQUIRED')
  assert.equal(await agentOf(withoutTeam), null)
  assert.equal(await prisma.drawingAgent.count(), 0)
})

test('l’agent pose le modèle de bout en bout, un pixel à chaque fin de délai du compte', async (t) => {
  const cookie = await createPlayer('Artiste', 'bleue')
  const model = [...row(0, 0, 3, '#aa0000'), { x: 1, y: 1, color: '#00AA00' }]

  const agent = await started(t, cookie, model)
  assert.deepEqual(Object.keys(agent).sort(), ['done', 'nextPlacementAt', 'pixels', 'startedAt', 'status', 'total'])
  assert.equal(agent.status, 'running')
  assert.equal(agent.total, 4)
  assert.equal(agent.done, 0)
  // Les couleurs reviennent en majuscules, comme pour une pose.
  assert.deepEqual(agent.pixels, [...row(0, 0, 3, '#AA0000'), { x: 1, y: 1, color: '#00AA00' }])
  assert.equal(new Date(agent.startedAt).toISOString(), agent.startedAt)

  const done = await finished(cookie)
  assert.equal(done.nextPlacementAt, null)
  for (const pixel of agent.pixels) assert.equal(await colorAt(pixel.x, pixel.y), pixel.color)

  // Les poses sont celles du compte, pour son équipe, dans l'ordre du modèle et espacées du délai.
  const account = await prisma.account.findUnique({ where: { pseudoKey: 'artiste' } })
  const placements = await prisma.pixelPlacement.findMany({
    where: { accountId: String(account.id) },
    orderBy: { revision: 'asc' },
  })
  assert.deepEqual(placements.map(({ x, y, color }) => ({ x, y, color })), agent.pixels)
  for (const placement of placements) assert.equal(placement.teamId, 'bleue')
  for (let index = 1; index < placements.length; index += 1) {
    assert.ok(placements[index].placedAt - placements[index - 1].placedAt >= COOLDOWN_MS)
  }
})

test('la progression avance, avec l’heure de la prochaine pose', async (t) => {
  const cookie = await createPlayer('Patient')
  await started(t, cookie, row(0, 5, 6))

  const working = await until(async () => {
    const agent = await agentOf(cookie)
    return agent.done >= 1 && agent.done < agent.total && agent.nextPlacementAt ? agent : null
  }, 'aucune progression en cours')
  assert.equal(new Date(working.nextPlacementAt).toISOString(), working.nextPlacementAt)
  assert.equal((await finished(cookie)).done, 6)
})

test('pendant que l’agent travaille, le joueur ne pose pas à la main : 409 AGENT_ACTIVE', async (t) => {
  const cookie = await createPlayer('Presse')
  await started(t, cookie, row(0, 10, 2))
  const pose = () => request('/api/pixels', { method: 'POST', cookie, body: { x: 20, y: 10, color: '#FFFFFF' } })

  const refused = await pose()
  assert.equal(refused.status, 409)
  assert.equal((await refused.json()).error.code, 'AGENT_ACTIVE')
  assert.equal(await colorAt(20, 10), null)

  // Même fini, l'agent garde le modèle : il faut l'arrêter pour reposer à la main.
  await finished(cookie)
  assert.equal((await pose()).status, 409)
  assert.equal((await request('/api/agent', { method: 'DELETE', cookie })).status, 204)
  await sleep(COOLDOWN_MS + 20)
  assert.equal((await pose()).status, 200)
})

test('l’agent repose un pixel de son modèle écrasé par une autre équipe', async (t) => {
  const cookie = await createPlayer('Gardien', 'verte')
  const rival = await createPlayer('Rival', 'jaune')
  await started(t, cookie, row(0, 15, 2, '#00AA00'))
  await finished(cookie)

  const overwritten = await request('/api/pixels', { method: 'POST', cookie: rival, body: { x: 1, y: 15, color: '#E5B700' } })
  assert.equal(overwritten.status, 200)
  await until(async () => (await colorAt(1, 15)) === '#00AA00', 'le pixel écrasé n’est pas réparé')
  assert.equal((await agentOf(cookie)).done, 2)
})

test('un pixel déjà à la bonne couleur n’est pas reposé', async (t) => {
  const cookie = await createPlayer('Econome')
  const helper = await createPlayer('Aide')
  const posed = await request('/api/pixels', { method: 'POST', cookie: helper, body: { x: 0, y: 20, color: '#123456' } })
  assert.equal(posed.status, 200)

  const agent = await started(t, cookie, row(0, 20, 2))
  assert.equal(agent.done, 1)
  await finished(cookie)
  const account = await prisma.account.findUnique({ where: { pseudoKey: 'econome' } })
  const placements = await prisma.pixelPlacement.findMany({ where: { accountId: String(account.id) } })
  assert.deepEqual(placements.map(({ x, y }) => [x, y]), [[1, 20]])
})

test('un seul modèle est actif par compte : 409 AGENT_ALREADY_ACTIVE', async (t) => {
  const cookie = await createPlayer('Gourmand')
  const first = await started(t, cookie, row(0, 25, 2))

  const second = await start(cookie, row(0, 26, 2))
  assert.equal(second.status, 409)
  assert.equal((await second.json()).error.code, 'AGENT_ALREADY_ACTIVE')
  assert.deepEqual((await agentOf(cookie)).pixels, first.pixels)

  // Après l'arrêt, un autre modèle peut partir.
  assert.equal((await request('/api/agent', { method: 'DELETE', cookie })).status, 204)
  assert.equal((await start(cookie, row(0, 26, 1))).status, 201)
})

test('le joueur arrête son agent : il ne pose plus, et arrêter deux fois n’est pas une erreur', async () => {
  const cookie = await createPlayer('Prudent')
  assert.equal((await start(cookie, row(0, 30, 20))).status, 201)
  await until(async () => (await agentOf(cookie)).done >= 1, 'aucune pose')

  assert.equal((await request('/api/agent', { method: 'DELETE', cookie })).status, 204)
  assert.equal((await request('/api/agent', { method: 'DELETE', cookie })).status, 204)
  assert.equal(await agentOf(cookie), null)
  // Une pose déjà commencée peut finir : la toile est comparée après.
  await sleep(COOLDOWN_MS)
  const placed = await prisma.pixel.count({ where: { y: 30 } })
  await sleep(COOLDOWN_MS * 4)
  assert.equal(await prisma.pixel.count({ where: { y: 30 } }), placed)
  assert.ok(placed < 20)
})

test('l’agent continue quand le joueur est déconnecté', async (t) => {
  const cookie = await createPlayer('Absent')
  await started(t, cookie, row(0, 35, 3))
  assert.equal((await request('/api/auth/logout', { method: 'POST', cookie })).status, 204)
  assert.equal((await request('/api/agent', { cookie })).status, 401)

  await until(async () => (await prisma.pixel.count({ where: { y: 35 } })) === 3, 'le modèle n’est pas fini')
  t.after(() => prisma.drawingAgent.deleteMany({}))
})

test('un agent enregistré reprend son modèle au démarrage du serveur', async (t) => {
  const cookie = await createPlayer('Revenant')
  const account = await prisma.account.findUnique({ where: { pseudoKey: 'revenant' } })
  // La ligne existe sans minuteur, comme après un redémarrage.
  await prisma.drawingAgent.create({
    data: { accountId: account.id, pixels: JSON.stringify(row(0, 40, 2)), startedAt: new Date() },
  })
  t.after(() => request('/api/agent', { method: 'DELETE', cookie }))
  await sleep(COOLDOWN_MS * 2)
  assert.equal((await agentOf(cookie)).done, 0)

  await server.agentService.resume()
  assert.equal((await finished(cookie)).done, 2)
})

test('un joueur banni ne lance pas d’agent, et son agent s’arrête', async (t) => {
  const admin = await register('Lea')
  await prisma.account.update({ where: { pseudoKey: 'lea' }, data: { role: 'admin' } })
  const cookie = await createPlayer('Banni')
  await started(t, cookie, row(0, 45, 30))
  await until(async () => (await agentOf(cookie)).done >= 1, 'aucune pose')

  const ban = await request('/api/moderation/bans', { method: 'POST', cookie: admin, body: { pseudo: 'Banni' } })
  assert.equal(ban.status, 200)
  await until(async () => (await agentOf(cookie)) === null, 'l’agent du joueur banni travaille encore')
  // Ses poses sont annulées, et plus aucune n'arrive.
  await sleep(COOLDOWN_MS * 3)
  assert.equal(await prisma.pixel.count({ where: { y: 45 } }), 0)

  const refused = await start(cookie, row(0, 46, 1))
  assert.equal(refused.status, 403)
  assert.equal((await refused.json()).error.code, 'ACCOUNT_BANNED')
})

test('refuse en 400 INVALID_INPUT un modèle hors contrat, sans lancer d’agent', async () => {
  const cookie = await createPlayer('Brouillon')
  const pixel = { x: 0, y: 0, color: '#123456' }
  const bodies = [
    undefined,
    {},
    { pixels: 'dragon' },
    { pixels: [] },
    { pixels: [null] },
    { pixels: [{ ...pixel, x: 51 }] },
    { pixels: [{ ...pixel, y: 1.5 }] },
    { pixels: [{ ...pixel, color: 'rouge' }] },
    { pixels: [{ x: 0, y: 0 }] },
    // Deux fois la même case.
    { pixels: [pixel, { ...pixel, color: '#654321' }] },
    // Plus de 32 cases de large, ou de haut.
    { pixels: [pixel, { ...pixel, x: 32 }] },
    { pixels: [pixel, { ...pixel, y: -32 }] },
  ]
  for (const body of bodies) {
    const response = await request('/api/agent', { method: 'POST', cookie, body })
    assert.equal(response.status, 400, JSON.stringify(body))
    assert.equal((await response.json()).error.code, 'INVALID_INPUT')
  }
  assert.equal(await agentOf(cookie), null)

  // 32 cases de large, c'est accepté.
  const widest = await start(cookie, [pixel, { ...pixel, x: 31 }])
  assert.equal(widest.status, 201)
  assert.equal((await request('/api/agent', { method: 'DELETE', cookie })).status, 204)
})

test('le lancement est refusé si le bannissement arrive après la lecture de la session', async (t) => {
  const admin = await register('AdminCourse')
  await prisma.account.update({ where: { pseudoKey: 'admincourse' }, data: { role: 'admin' } })
  const cookie = await createPlayer('CompteCourse')
  const startAgent = server.agentService.startAgent
  t.mock.method(server.agentService, 'startAgent', async (body, account) => {
    assert.equal(account.bannedAt, null)
    const ban = await request('/api/moderation/bans', { method: 'POST', cookie: admin, body: { pseudo: 'CompteCourse' } })
    assert.equal(ban.status, 200)
    return startAgent(body, account)
  }, { times: 1 })

  const response = await start(cookie, row(0, 47, 1))
  assert.equal(response.status, 403)
  assert.equal((await response.json()).error.code, 'ACCOUNT_BANNED')
  assert.equal(await agentOf(cookie), null)
})

test('le bannissement retire l’agent enregistré avant le retour de la réponse', async () => {
  const admin = await register('AdminArret')
  await prisma.account.update({ where: { pseudoKey: 'adminarret' }, data: { role: 'admin' } })
  const cookie = await createPlayer('CompteArret')
  const account = await prisma.account.findUniqueOrThrow({ where: { pseudoKey: 'comptearret' } })
  // Un agent en base sans minuteur reproduit le délai entre deux passages de l’agent.
  await prisma.drawingAgent.create({
    data: { accountId: account.id, pixels: JSON.stringify(row(0, 48, 1)), startedAt: new Date() },
  })
  assert.equal((await agentOf(cookie)).status, 'running')

  const ban = await request('/api/moderation/bans', { method: 'POST', cookie: admin, body: { pseudo: 'CompteArret' } })
  assert.equal(ban.status, 200)
  assert.equal(await agentOf(cookie), null)
  assert.equal(await prisma.drawingAgent.count({ where: { accountId: account.id } }), 0)
})
