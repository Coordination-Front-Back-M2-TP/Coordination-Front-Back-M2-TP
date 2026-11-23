import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { once } from 'node:events'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { after, before, test } from 'node:test'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import prismaClient from '@prisma/client'
import { createCanvasRepository } from '../src/canvas/canvas-repository.js'
import { createPlacementRepository } from '../src/placements/placement-repository.js'
import { createCanvasServer } from '../src/server.js'

const backDirectory = fileURLToPath(new URL('../', import.meta.url))
const databasePath = join(backDirectory, 'prisma', `test-placements-${process.pid}.db`)
const databaseUrl = `file:./prisma/test-placements-${process.pid}.db`
const { PrismaClient } = prismaClient
let prisma
let server
let baseUrl

// Horloge du serveur, pilotée par les tests : chaque pose reçoit l'heure voulue, sans attendre.
let clock = new Date('2026-11-01T10:00:00.000Z')

// Les cinq poses de l'histoire, dans l'ordre. La quatrième remplace la première.
const STORY = [
  { at: '2026-11-01T10:00:00.000Z', account: 'alice', x: 0, y: 0, color: '#111111' },
  { at: '2026-11-01T10:05:00.000Z', account: 'bob', x: 1, y: 0, color: '#222222' },
  { at: '2026-11-01T10:10:00.000Z', account: 'alice', x: 2, y: 0, color: '#333333' },
  { at: '2026-11-01T10:15:00.000Z', account: 'bob', x: 0, y: 0, color: '#444444' },
  { at: '2026-11-01T10:20:00.000Z', account: 'alice', x: 3, y: 0, color: '#555555' },
]

// Session factice pour les tests, comme dans pose.test.js.
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
    repository: createCanvasRepository(prisma, { now: () => clock }),
    placementRepository: createPlacementRepository(prisma),
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

async function history(query = '') {
  const response = await fetch(`${baseUrl}/api/placements${query}`)
  return { status: response.status, body: await response.json() }
}

function colors(body) {
  return body.placements.map((placement) => placement.color)
}

test('une toile sans pose renvoie un historique vide', async () => {
  const { status, body } = await history()
  assert.equal(status, 200)
  assert.deepEqual(body, { placements: [], nextCursor: null })
})

test('sans période, l’historique part de la première pose et les donne toutes, dans l’ordre', async () => {
  for (const { at, account, x, y, color } of STORY) {
    clock = new Date(at)
    const response = await fetch(`${baseUrl}/api/pixels`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-test-account': account },
      body: JSON.stringify({ x, y, color }),
    })
    assert.equal(response.status, 200)
  }

  const { status, body } = await history()
  assert.equal(status, 200)
  assert.equal(body.nextCursor, null)
  assert.deepEqual(
    body.placements.map(({ x, y, color, placedAt }) => ({ at: placedAt, x, y, color })),
    STORY.map(({ at, x, y, color }) => ({ at, x, y, color })),
  )
  const revisions = body.placements.map((placement) => placement.revision)
  assert.deepEqual(revisions, [...revisions].sort((a, b) => a - b))
})

test('une pose de l’historique ne contient ni compte ni équipe', async () => {
  const { body } = await history()
  for (const placement of body.placements) {
    assert.deepEqual(Object.keys(placement).sort(), ['color', 'placedAt', 'revision', 'x', 'y'])
  }
})

test('la pose remplacée reste dans l’historique', async () => {
  const { body } = await history()
  const atOrigin = body.placements.filter((placement) => placement.x === 0 && placement.y === 0)
  assert.deepEqual(atOrigin.map((placement) => placement.color), ['#111111', '#444444'])
})

test('from est inclus, to est exclu', async () => {
  const period = await history('?from=2026-11-01T10:05:00.000Z&to=2026-11-01T10:15:00.000Z')
  assert.deepEqual(colors(period.body), ['#222222', '#333333'])

  const since = await history('?from=2026-11-01T10:15:00.000Z')
  assert.deepEqual(colors(since.body), ['#444444', '#555555'])

  const until = await history('?to=2026-11-01T10:05:00.000Z')
  assert.deepEqual(colors(until.body), ['#111111'])

  const empty = await history('?from=2027-01-01T00:00:00.000Z')
  assert.deepEqual(empty.body, { placements: [], nextCursor: null })
})

test('une date avec un décalage horaire désigne le même instant', async () => {
  const { body } = await history(`?from=${encodeURIComponent('2026-11-02T00:15:00+14:00')}`)
  assert.deepEqual(colors(body), ['#444444', '#555555'])
})

test('le 29 février est accepté pendant une année bissextile', async () => {
  const { status, body } = await history('?from=2024-02-29T23:30:00-02:00')
  assert.equal(status, 200)
  assert.deepEqual(colors(body), STORY.map((pose) => pose.color))
})

test('limit et after parcourent l’historique page par page, sans trou ni doublon', async () => {
  const seen = []
  let query = '?limit=2'
  let pages = 0
  while (query) {
    const { status, body } = await history(query)
    assert.equal(status, 200)
    assert.equal(body.placements.length <= 2, true)
    seen.push(...colors(body))
    pages += 1
    query = body.nextCursor === null ? null : `?limit=2&after=${body.nextCursor}`
  }
  assert.equal(pages, 3)
  assert.deepEqual(seen, STORY.map((pose) => pose.color))
})

test('une page pleine qui finit l’historique n’annonce pas de page suivante', async () => {
  const { body } = await history('?limit=5')
  assert.equal(body.placements.length, 5)
  assert.equal(body.nextCursor, null)
})

test('la pagination respecte la période', async () => {
  const first = await history('?from=2026-11-01T10:05:00.000Z&to=2026-11-01T10:20:00.000Z&limit=2')
  assert.deepEqual(colors(first.body), ['#222222', '#333333'])
  const next = await history(
    `?from=2026-11-01T10:05:00.000Z&to=2026-11-01T10:20:00.000Z&limit=2&after=${first.body.nextCursor}`,
  )
  assert.deepEqual(colors(next.body), ['#444444'])
  assert.equal(next.body.nextCursor, null)
})

test('refuse en 400 INVALID_INPUT une période ou une page hors contrat', async () => {
  const invalid = [
    '?from=hier',
    '?from=2026-11-01',
    '?from=2026-11-01T10:00:00',
    '?to=2026-13-45T10:00:00.000Z',
    '?from=2026-02-29T10:00:00Z',
    '?to=2026-02-30T10:00:00Z',
    '?to=2026-04-31T00:30:00%2B02:00',
    '?from=2026-11-01T10:00:00.000Z&from=2026-11-01T10:05:00.000Z',
    '?from=2026-11-01T10:10:00.000Z&to=2026-11-01T10:10:00.000Z',
    '?from=2026-11-01T10:10:00.000Z&to=2026-11-01T10:00:00.000Z',
    '?limit=0',
    '?limit=1001',
    '?limit=1.5',
    '?limit=abc',
    '?limit=',
    '?after=-1',
    '?after=abc',
  ]
  for (const query of invalid) {
    const { status, body } = await history(query)
    assert.equal(status, 400, query)
    assert.equal(body.error.code, 'INVALID_INPUT', query)
  }
})

test('l’historique se lit sans compte', async () => {
  const response = await fetch(`${baseUrl}/api/placements`)
  assert.equal(response.status, 200)
})
