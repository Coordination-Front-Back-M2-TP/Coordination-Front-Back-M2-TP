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
import { createRankingRepository } from '../src/rankings/ranking-repository.js'
import { rankTeams } from '../src/rankings/ranking-service.js'
import { createCanvasServer } from '../src/server.js'

const backDirectory = fileURLToPath(new URL('../', import.meta.url))
const databasePath = join(backDirectory, 'prisma', `test-rankings-${process.pid}.db`)
const databaseUrl = `file:./prisma/test-rankings-${process.pid}.db`
const { PrismaClient } = prismaClient
let prisma
let server
let baseUrl

// Session factice pour les tests : l'en-tête désigne l'équipe du joueur connecté.
// Les vraies équipes arriveront avec la tâche #41.
async function testPlayer(req) {
  const teamId = req.get('x-test-team')
  return teamId ? { accountId: `joueur-${teamId}`, teamId } : null
}

before(async () => {
  execFileSync(process.execPath, [join(backDirectory, 'scripts', 'prisma.js'), 'migrate', 'deploy'], {
    cwd: backDirectory,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'pipe',
  })
  prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: databaseUrl }) })
  server = createCanvasServer({
    repository: createCanvasRepository(prisma),
    rankingRepository: createRankingRepository(prisma),
    resolvePlayer: testPlayer,
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

async function pose(teamId, x, y, color = '#123456') {
  const response = await fetch(`${baseUrl}/api/pixels`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-test-team': teamId },
    body: JSON.stringify({ x, y, color }),
  })
  assert.equal(response.status, 200)
  return (await response.json()).pixel
}

async function ranking() {
  const response = await fetch(`${baseUrl}/api/rankings`)
  assert.equal(response.status, 200)
  return response.json()
}

// Abonne un socket à la toile et garde les classements reçus, dans l'ordre.
async function listen(t) {
  const socket = createClient(baseUrl)
  t.after(() => socket.disconnect())
  await once(socket, 'connect')
  const received = []
  socket.on('ranking:updated', (payload) => received.push(payload))
  await socket.timeout(1000).emitWithAck('canvas:subscribe')
  return { socket, received }
}

// Attend le classement diffusé pour une révision donnée.
async function waitForRevision(received, revision) {
  const deadline = Date.now() + 2000
  while (Date.now() < deadline) {
    const match = received.find((payload) => payload.revision === revision)
    if (match) return match
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error(`Aucun classement reçu pour la révision ${revision}`)
}

test('rankTeams trie par nombre de pixels et donne le même rang aux équipes à égalité', () => {
  assert.deepEqual(rankTeams([]), [])
  assert.deepEqual(
    rankTeams([
      { teamId: 'verte', pixelCount: 2 },
      { teamId: 'rouge', pixelCount: 5 },
      { teamId: 'jaune', pixelCount: 1 },
      { teamId: 'bleue', pixelCount: 2 },
    ]),
    [
      { teamId: 'rouge', pixelCount: 5, rank: 1 },
      { teamId: 'bleue', pixelCount: 2, rank: 2 },
      { teamId: 'verte', pixelCount: 2, rank: 2 },
      { teamId: 'jaune', pixelCount: 1, rank: 4 },
    ],
  )
})

test('une toile sans pose a un classement vide', async () => {
  assert.deepEqual(await ranking(), { revision: 0, teams: [] })
})

test('le classement compte les pixels de chaque équipe et se lit sans compte', async () => {
  await pose('rouge', 0, 0)
  await pose('rouge', 1, 0)
  const last = await pose('bleue', 2, 0)

  assert.deepEqual(await ranking(), {
    revision: last.revision,
    teams: [
      { teamId: 'rouge', pixelCount: 2, rank: 1 },
      { teamId: 'bleue', pixelCount: 1, rank: 2 },
    ],
  })
})

test('un pixel compte pour l’équipe qui l’a posé en dernier', async () => {
  // La case (0, 0) passe de rouge à bleue : rouge perd un pixel, bleue en gagne un.
  await pose('bleue', 0, 0)
  assert.deepEqual((await ranking()).teams, [
    { teamId: 'bleue', pixelCount: 2, rank: 1 },
    { teamId: 'rouge', pixelCount: 1, rank: 2 },
  ])

  // Reposer sur sa propre case ne compte pas deux fois.
  await pose('bleue', 0, 0, '#654321')
  assert.deepEqual((await ranking()).teams, [
    { teamId: 'bleue', pixelCount: 2, rank: 1 },
    { teamId: 'rouge', pixelCount: 1, rank: 2 },
  ])
})

test('une équipe qui n’a plus de pixel sort du classement', async () => {
  await pose('bleue', 1, 0)
  assert.deepEqual((await ranking()).teams, [{ teamId: 'bleue', pixelCount: 3, rank: 1 }])
})

test('le classement ne contient aucune identité de joueur', async () => {
  const body = await ranking()
  assert.deepEqual(Object.keys(body).sort(), ['revision', 'teams'])
  for (const team of body.teams) assert.deepEqual(Object.keys(team).sort(), ['pixelCount', 'rank', 'teamId'])
})

test('une pose qui change le classement est diffusée aux abonnés de la toile', async (t) => {
  const { received } = await listen(t)

  const pixel = await pose('verte', 10, 10)
  const payload = await waitForRevision(received, pixel.revision)
  assert.deepEqual(payload, await ranking())
  assert.deepEqual(payload.teams, [
    { teamId: 'bleue', pixelCount: 3, rank: 1 },
    { teamId: 'verte', pixelCount: 1, rank: 2 },
  ])
})

test('une pose qui ne change pas le classement n’est pas rediffusée', async (t) => {
  const { received } = await listen(t)

  // Verte repose sur sa propre case : les comptes ne bougent pas.
  const same = await pose('verte', 10, 10, '#abcdef')
  const changing = await pose('verte', 11, 10)
  await waitForRevision(received, changing.revision)

  assert.equal(received.some((payload) => payload.revision === same.revision), false)
})

test('un socket désabonné ne reçoit plus le classement', async (t) => {
  const { socket, received } = await listen(t)
  const witness = await listen(t)
  socket.emit('canvas:unsubscribe')
  // Un aller-retour avec le serveur laisse au désabonnement le temps d'être traité avant la pose.
  await witness.socket.timeout(1000).emitWithAck('canvas:subscribe')

  const pixel = await pose('jaune', 20, 20)
  await waitForRevision(witness.received, pixel.revision)
  assert.deepEqual(received, [])
})

test('un pixel écrit sans joueur retire la case à l’équipe qui la tenait', async () => {
  const before = (await ranking()).teams.find((team) => team.teamId === 'jaune')
  assert.equal(before.pixelCount, 1)

  // Écriture du serveur sans session, comme le fera un nettoyage de zone : la case n'est plus à personne.
  await server.canvasService.savePixel({ x: 20, y: 20, color: '#000000' })
  assert.equal((await ranking()).teams.some((team) => team.teamId === 'jaune'), false)
})

test('sans dépôt de classement, le serveur diffuse les pixels sans classement', async (t) => {
  let revision = 0
  const quiet = createCanvasServer({
    repository: {
      async getSnapshot() {
        return { width: 101, height: 101, revision, snapshotAt: new Date().toISOString(), pixels: [] }
      },
      async savePixel(pixel) {
        revision += 1
        return { ...pixel, updatedAt: new Date().toISOString(), revision }
      },
    },
  })
  quiet.httpServer.listen(0)
  await once(quiet.httpServer, 'listening')
  t.after(() => new Promise((resolve) => quiet.io.close(resolve)))
  assert.equal(quiet.rankingService, undefined)

  const socket = createClient(`http://localhost:${quiet.httpServer.address().port}`)
  t.after(() => socket.disconnect())
  await once(socket, 'connect')
  let rankings = 0
  socket.on('ranking:updated', () => { rankings += 1 })
  await socket.timeout(1000).emitWithAck('canvas:subscribe')
  const updated = once(socket, 'pixel:updated')
  await quiet.canvasService.savePixel({ x: 0, y: 0, color: '#000000' })
  await updated
  assert.equal(rankings, 0)
})
