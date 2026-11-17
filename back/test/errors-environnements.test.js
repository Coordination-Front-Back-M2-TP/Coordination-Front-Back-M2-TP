import assert from 'node:assert/strict'
import { once } from 'node:events'
import { test } from 'node:test'
import express from 'express'
import { app } from '../src/app.js'
import { badRequest, internalError } from '../src/errors/app-error.js'
import { errorHandler, notFoundHandler } from '../src/middleware/error-handler.js'

const SECRET = 'postgres://utilisateur:mot-de-passe@base-interne/p1x3l'

function createTestApp() {
  const testApp = express()
  testApp.use(express.json())
  testApp.get('/test/expected', (req, res, next) => {
    next(badRequest('Couleur invalide.', 'INVALID_INPUT', { field: 'color', hint: SECRET }))
  })
  testApp.get('/test/unexpected', () => {
    throw new Error(`Connexion refusée vers ${SECRET}`)
  })
  testApp.get('/test/internal', (req, res, next) => {
    next(internalError('Panne interne.', 'DB_DOWN', { dsn: SECRET }))
  })
  testApp.get('/test/prisma-unknown', (req, res, next) => {
    const error = new Error(`Invalid prisma.pixel.findMany() invocation near ${SECRET}`)
    error.name = 'PrismaClientKnownRequestError'
    error.code = 'P2024'
    next(error)
  })
  testApp.get('/test/sqlite-unique', (req, res, next) => {
    next(new Error('SQLITE_CONSTRAINT: UNIQUE constraint failed: Pixel.x, Pixel.y'))
  })
  testApp.use(notFoundHandler)
  testApp.use(errorHandler)
  return testApp
}

// Lance une requête sur l'application dans l'environnement demandé, journaux réduits au silence.
async function requete(t, nodeEnv, chemin, options, application = createTestApp()) {
  const ancienEnv = process.env.NODE_ENV
  const ancienWarn = console.warn
  const ancienError = console.error
  const ancienLog = console.log
  if (nodeEnv === undefined) delete process.env.NODE_ENV
  else process.env.NODE_ENV = nodeEnv
  const journaux = []
  console.warn = console.error = console.log = (...args) => journaux.push(args.join(' '))
  const server = application.listen(0)
  t.after(() => {
    server.close()
    console.warn = ancienWarn
    console.error = ancienError
    console.log = ancienLog
    if (ancienEnv === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = ancienEnv
  })
  await once(server, 'listening')
  const res = await fetch(`http://localhost:${server.address().port}${chemin}`, options)
  return { res, body: await res.json(), journaux: journaux.join('\n') }
}

test('En développement, une erreur attendue expose ses détails pour le débogage', async (t) => {
  const { res, body } = await requete(t, 'development', '/test/expected')
  assert.equal(res.status, 400)
  assert.equal(body.error.code, 'INVALID_INPUT')
  assert.equal(body.error.message, 'Couleur invalide.')
  assert.deepEqual(body.error.details, { field: 'color', hint: SECRET })
  assert.match(body.error.stack, /AppError/)
})

test('Sans NODE_ENV, le comportement est celui du développement', async (t) => {
  const { res, body } = await requete(t, undefined, '/test/unexpected')
  assert.equal(res.status, 500)
  assert.match(body.error.stack, /Error: Connexion refusée/)
})

test('En développement, une erreur inattendue expose message et stack', async (t) => {
  const { res, body } = await requete(t, 'development', '/test/unexpected')
  assert.equal(res.status, 500)
  assert.equal(body.error.code, 'INTERNAL_SERVER_ERROR')
  assert.match(body.error.message, /Connexion refusée/)
  assert.equal(typeof body.error.stack, 'string')
})

test('En production, une erreur attendue garde son message mais perd stack et détails', async (t) => {
  const { res, body } = await requete(t, 'production', '/test/expected')
  assert.equal(res.status, 400)
  assert.deepEqual(body, { error: { code: 'INVALID_INPUT', message: 'Couleur invalide.' } })
  assert.doesNotMatch(JSON.stringify(body), /mot-de-passe/)
})

test('En production, une erreur inattendue renvoie exactement le message générique', async (t) => {
  const { res, body, journaux } = await requete(t, 'production', '/test/unexpected')
  assert.equal(res.status, 500)
  assert.deepEqual(body, {
    error: { code: 'INTERNAL_SERVER_ERROR', message: 'Une erreur inattendue est survenue.' },
  })
  assert.doesNotMatch(journaux, /mot-de-passe/)
})

test('En production, une AppError 500 masque son code et ses détails internes', async (t) => {
  const { res, body } = await requete(t, 'production', '/test/internal')
  assert.equal(res.status, 500)
  assert.deepEqual(body, {
    error: { code: 'INTERNAL_SERVER_ERROR', message: 'Une erreur inattendue est survenue.' },
  })
})

test('En production, une erreur Prisma non prévue ne fuit ni message ni code ORM', async (t) => {
  const { res, body, journaux } = await requete(t, 'production', '/test/prisma-unknown')
  assert.equal(res.status, 500)
  assert.deepEqual(body, {
    error: { code: 'INTERNAL_SERVER_ERROR', message: 'Une erreur inattendue est survenue.' },
  })
  assert.doesNotMatch(JSON.stringify(body), /P2024|prisma|mot-de-passe/i)
  assert.doesNotMatch(journaux, /mot-de-passe/)
})

test('Une contrainte d’unicité SQLite directe est normalisée en 409 CONFLICT', async (t) => {
  const { res, body } = await requete(t, 'production', '/test/sqlite-unique')
  assert.equal(res.status, 409)
  assert.deepEqual(body, { error: { code: 'CONFLICT', message: 'Cette ressource existe déjà.' } })
})

test('L’application réelle renvoie le format d’erreur sur une route inconnue', async (t) => {
  const { res, body } = await requete(t, 'production', '/api/inconnue', undefined, app)
  assert.equal(res.status, 404)
  assert.deepEqual(body, { error: { code: 'NOT_FOUND', message: 'Route introuvable.' } })
})

test('L’application réelle renvoie INVALID_JSON sur un corps illisible', async (t) => {
  const { res, body } = await requete(t, 'production', '/api/health', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{"cassé": ',
  }, app)
  assert.equal(res.status, 400)
  assert.equal(body.error.code, 'INVALID_JSON')
  assert.doesNotMatch(JSON.stringify(body), /Unexpected|position/i)
})
