import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { once } from 'node:events'
import { rm } from 'node:fs/promises'
import { createServer } from 'node:http'
import { join } from 'node:path'
import { after, before, beforeEach, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import prismaClient from '@prisma/client'
import { createAccountRepository } from '../src/accounts/account-repository.js'
import { createAccountService } from '../src/accounts/account-service.js'
import { createApp } from '../src/app.js'
import { createModelProviders } from '../src/models/model-providers.js'
import { createModelRepository } from '../src/models/model-repository.js'
import { createModelService } from '../src/models/model-service.js'

const backDirectory = fileURLToPath(new URL('../', import.meta.url))
const databasePath = join(backDirectory, 'prisma', `test-models-${process.pid}.db`)
const databaseUrl = `file:./prisma/test-models-${process.pid}.db`
const { PrismaClient } = prismaClient
const INPUT = { prompt: '  Un éclair  ', moderationProvider: 'jev' }
const DAY = '2026-11-21'
const NOW = `${DAY}T12:00:00.000Z`
let prisma
let server
let baseUrl
let now
let calls
let respondWith

const jev = (noul) => Response.json({ answers: { suitable: { type: 'noul', noul } } })
const gpt = (rows = ['.8', '80']) => Response.json({
  status: 'completed',
  output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ rows }) }] }],
})

async function fakeFetch(url, options) {
  const endpoint = new URL(url).pathname
  const body = JSON.parse(options.body)
  calls.push({ endpoint, body })
  assert.equal(options.method, 'POST')
  assert.ok(options.signal instanceof AbortSignal)
  return respondWith(endpoint)
}

before(async () => {
  execFileSync(process.execPath, [join(backDirectory, 'scripts', 'prisma.js'), 'migrate', 'deploy'], {
    cwd: backDirectory,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'pipe',
  })
  prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: databaseUrl }) })
  const accountService = createAccountService({ repository: createAccountRepository(prisma) })
  const providers = createModelProviders({
    env: { OPENAI_API_KEY: 'cle-fictive-openai', OPENAI_MODEL: 'modele-de-test', TYPESAFE_API_KEY: 'cle-fictive-jev' },
    fetcher: fakeFetch,
  })
  const modelService = createModelService({ repository: createModelRepository(prisma), providers, now: () => new Date(now) })
  server = createServer(createApp({ accountService, modelService }))
  server.listen(0)
  await once(server, 'listening')
  baseUrl = `http://localhost:${server.address().port}`
})

beforeEach(() => {
  now = NOW
  calls = []
  respondWith = (endpoint) => {
    if (endpoint === '/v1/systemone') return jev(0.95)
    if (endpoint === '/v1/moderations') return Response.json({ results: [{ flagged: false }] })
    assert.equal(endpoint, '/v1/responses')
    return gpt()
  }
})

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve))
  if (prisma) await prisma.$disconnect()
  for (const suffix of ['', '-journal', '-shm', '-wal']) await rm(`${databasePath}${suffix}`, { force: true })
})

function request(path, { body, cookie } = {}) {
  const headers = {}
  if (cookie) headers.cookie = cookie
  if (body) headers['Content-Type'] = 'application/json'
  return fetch(`${baseUrl}${path}`, { method: body ? 'POST' : 'GET', body: body && JSON.stringify(body), headers })
}

async function register(pseudo) {
  const response = await request('/api/auth/register', { body: { pseudo, password: 'mot-de-passe-de-test' } })
  assert.equal(response.status, 201)
  return response.headers.getSetCookie()[0].split(';')[0]
}

const generate = (cookie, body = INPUT) => request('/api/models', { cookie, body })

async function quota(cookie) {
  const response = await request('/api/models/quota', { cookie })
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('Cache-Control'), 'no-store')
  return response.json()
}

async function rejectsWith(response, status, code) {
  assert.equal(response.status, status)
  assert.equal(response.headers.get('Cache-Control'), 'no-store')
  assert.equal((await response.json()).error.code, code)
}

test('exige une session et valide la consigne avant tout appel externe', async () => {
  await rejectsWith(await request('/api/models/quota'), 401, 'UNAUTHORIZED')
  await rejectsWith(await generate(undefined), 401, 'UNAUTHORIZED')
  const cookie = await register('SansAppel')
  for (const body of [{}, { ...INPUT, prompt: '  ' }, { ...INPUT, prompt: '😀'.repeat(501) }, { ...INPUT, moderationProvider: 'autre' }]) {
    await rejectsWith(await generate(cookie, body), 400, 'INVALID_INPUT')
  }
  assert.deepEqual(calls, [])
})

test('Jev contrôle uniquement la consigne, puis GPT renvoie un modèle et un quota mis à jour', async () => {
  const cookie = await register('ModeleJev')
  assert.deepEqual(await quota(cookie), {
    quota: { limit: 5, remaining: 5, resetsAt: '2026-11-22T00:00:00.000Z' },
    moderationProviders: ['jev', 'openai'],
  })
  const response = await generate(cookie, { ...INPUT, accountId: 999, pseudo: 'autre' })
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {
    quota: { limit: 5, remaining: 4, resetsAt: '2026-11-22T00:00:00.000Z' },
    model: {
      width: 2, height: 2,
      pixels: [{ x: 1, y: 0, color: '#FACC15' }, { x: 0, y: 1, color: '#FACC15' }, { x: 1, y: 1, color: '#000000' }],
    },
  })
  assert.deepEqual(calls.map(({ endpoint }) => endpoint), ['/v1/systemone', '/v1/responses'])
  assert.deepEqual(calls[0].body.state, { prompt: 'Un éclair' })
  assert.equal(calls[1].body.input, 'Un éclair')
  assert.equal(calls[1].body.text.format.strict, true)
  assert.equal(calls[1].body.store, false)
})

test('un refus, un fournisseur indisponible et une grille invalide laissent le quota intact', async () => {
  const cookie = await register('GardeQuota')
  respondWith = () => jev(0.5)
  await rejectsWith(await generate(cookie), 422, 'PROMPT_REJECTED')
  assert.deepEqual(calls.map(({ endpoint }) => endpoint), ['/v1/systemone'])

  respondWith = () => Response.json({}, { status: 503 })
  await rejectsWith(await generate(cookie), 500, 'INTERNAL_SERVER_ERROR')
  assert.deepEqual(calls.map(({ endpoint }) => endpoint), ['/v1/systemone', '/v1/systemone'])

  respondWith = (endpoint) => endpoint === '/v1/moderations' ? Response.json({ results: [{ flagged: false }] }) : gpt(['.'])
  await rejectsWith(await generate(cookie, { ...INPUT, moderationProvider: 'openai' }), 500, 'INTERNAL_SERVER_ERROR')
  assert.deepEqual(calls.slice(2).map(({ endpoint }) => endpoint), ['/v1/moderations', '/v1/responses'])
  assert.equal((await quota(cookie)).quota.remaining, 5)
  assert.equal(await prisma.modelRequest.count(), 0)
})

test('un seul modèle simultané et quota commun aux deux services, par compte', async () => {
  const cookie = await register('QuotaCommun')
  const other = await register('AutreQuota')
  const openai = { ...INPUT, moderationProvider: 'openai' }
  for (let index = 0; index < 4; index += 1) assert.equal((await generate(cookie, openai)).status, 200)

  const started = Promise.withResolvers()
  const finish = Promise.withResolvers()
  respondWith = (endpoint) => {
    assert.equal(endpoint, '/v1/systemone')
    started.resolve()
    return finish.promise
  }
  const first = generate(cookie)
  try {
    await Promise.race([started.promise, first.then((response) => {
      assert.fail(`La première demande s’est terminée avant la modération (${response.status})`)
    })])
    await rejectsWith(await generate(cookie, openai), 409, 'MODEL_REQUEST_IN_PROGRESS')
  } finally {
    respondWith = () => gpt()
    finish.resolve(jev(0.99))
  }
  assert.equal((await first).status, 200)
  const atLimit = await generate(cookie, openai)
  assert.equal(atLimit.headers.get('Retry-After'), '43200')
  await rejectsWith(atLimit, 429, 'MODEL_QUOTA_EXHAUSTED')
  assert.equal((await quota(cookie)).quota.remaining, 0)
  assert.equal((await quota(other)).quota.remaining, 5)
  assert.equal(calls.length, 10)
})

test('une génération à minuit est débitée le jour de son acceptation', async () => {
  const cookie = await register('HeureUTC')
  now = `${DAY}T23:59:59.000Z`
  respondWith = (endpoint) => {
    if (endpoint === '/v1/systemone') return jev(0.95)
    now = '2026-11-22T00:00:01.000Z'
    return gpt()
  }
  const response = await generate(cookie)
  assert.equal(response.status, 200)
  assert.deepEqual((await response.json()).quota, { limit: 5, remaining: 5, resetsAt: '2026-11-23T00:00:00.000Z' })
  const account = await prisma.account.findUniqueOrThrow({ where: { pseudoKey: 'heureutc' } })
  const saved = await prisma.modelQuota.findUniqueOrThrow({ where: { accountId_day: { accountId: account.id, day: DAY } } })
  assert.equal(saved.used, 1)
})

test('une réservation expirée peut être remplacée sans que l’ancienne demande débite le quota', async () => {
  await register('Reservation')
  const account = await prisma.account.findUniqueOrThrow({ where: { pseudoKey: 'reservation' } })
  const repository = createModelRepository(prisma)
  const first = {
    accountId: account.id, day: DAY, limit: 5, token: 'ancien',
    now: new Date(NOW), expiresAt: new Date(`${DAY}T12:02:00.000Z`),
  }
  const second = {
    ...first, token: 'nouveau', now: first.expiresAt, expiresAt: new Date(`${DAY}T12:04:00.000Z`),
  }
  assert.equal(await repository.reserve(first), 'reserved')
  assert.equal(await repository.reserve(second), 'reserved')
  assert.equal(await repository.consume({ ...first, now: second.now }), false)
  await repository.release(first.accountId, first.token)
  assert.equal(await repository.consume(second), true)
  assert.equal(await repository.countUsed(account.id, DAY), 1)
})
