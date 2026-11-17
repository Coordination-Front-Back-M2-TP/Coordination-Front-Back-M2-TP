import assert from 'node:assert/strict'
import { once } from 'node:events'
import { test } from 'node:test'
import express from 'express'
import { badRequest, tooManyRequests } from '../src/errors/app-error.js'
import { errorHandler, notFoundHandler } from '../src/middleware/error-handler.js'
import { sanitize } from '../src/utils/logger.js'

function createTestApp() {
  const testApp = express()
  testApp.use(express.json())

  testApp.get('/test/operational', (req, res, next) => {
    next(badRequest('Paramètre invalide.', 'INVALID_PARAM', { field: 'color' }))
  })

  testApp.get('/test/cooldown', (req, res, next) => {
    next(tooManyRequests('Attends encore 5 secondes avant de poser un pixel.'))
  })

  testApp.get('/test/unexpected', () => {
    throw new Error('Crash inattendu ou secret de base de données')
  })

  testApp.get('/test/prisma-unique', (req, res, next) => {
    const error = new Error('Unique constraint failed')
    error.name = 'PrismaClientKnownRequestError'
    error.code = 'P2002'
    error.meta = { target: ['email'] }
    next(error)
  })

  testApp.get('/test/prisma-not-found', (req, res, next) => {
    const error = new Error('Record to update not found')
    error.name = 'PrismaClientKnownRequestError'
    error.code = 'P2025'
    next(error)
  })

  testApp.post('/test/json', (req, res) => {
    res.json({ received: req.body })
  })

  testApp.use(notFoundHandler)
  testApp.use(errorHandler)

  return testApp
}

test('Route inexistante renvoie 404 sans refléter l’URL de la requête', async (t) => {
  const testApp = createTestApp()
  const server = testApp.listen(0)
  t.after(() => server.close())
  await once(server, 'listening')

  const originalWarn = console.warn
  let logOutput = ''
  console.warn = (message) => {
    logOutput = message
  }

  try {
    const secret = 'query-secret-that-must-not-leak'
    const res = await fetch(`http://localhost:${server.address().port}/api/route-inexistante?token=${secret}`)
    assert.equal(res.status, 404)
    const body = await res.json()
    assert.equal(body.error.code, 'NOT_FOUND')
    assert.equal(body.error.message, 'Route introuvable.')
    assert.doesNotMatch(JSON.stringify(body), new RegExp(secret))
    assert.doesNotMatch(logOutput, new RegExp(secret))
    assert.doesNotMatch(logOutput, /route-inexistante/)
  } finally {
    console.warn = originalWarn
  }
})

test('Erreur opérationnelle renvoie le code HTTP et le format attendus', async (t) => {
  const testApp = createTestApp()
  const server = testApp.listen(0)
  t.after(() => server.close())
  await once(server, 'listening')

  const res = await fetch(`http://localhost:${server.address().port}/test/operational`)
  assert.equal(res.status, 400)
  const body = await res.json()
  assert.equal(body.error.code, 'INVALID_PARAM')
  assert.equal(body.error.message, 'Paramètre invalide.')
  assert.deepEqual(body.error.details, { field: 'color' })
})

test('Erreur de cooldown renvoie 429 avec COOLDOWN_ACTIVE', async (t) => {
  const testApp = createTestApp()
  const server = testApp.listen(0)
  t.after(() => server.close())
  await once(server, 'listening')

  const res = await fetch(`http://localhost:${server.address().port}/test/cooldown`)
  assert.equal(res.status, 429)
  const body = await res.json()
  assert.equal(body.error.code, 'COOLDOWN_ACTIVE')
  assert.match(body.error.message, /Attends encore 5 secondes/i)
})

test('Erreur de syntaxe JSON renvoie 400 INVALID_JSON', async (t) => {
  const testApp = createTestApp()
  const server = testApp.listen(0)
  t.after(() => server.close())
  await once(server, 'listening')

  const res = await fetch(`http://localhost:${server.address().port}/test/json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{"invalidJson": ...',
  })
  assert.equal(res.status, 400)
  const body = await res.json()
  assert.equal(body.error.code, 'INVALID_JSON')
})

test('Erreur Prisma P2002 normalisée en 409 CONFLICT', async (t) => {
  const testApp = createTestApp()
  const server = testApp.listen(0)
  t.after(() => server.close())
  await once(server, 'listening')

  const res = await fetch(`http://localhost:${server.address().port}/test/prisma-unique`)
  assert.equal(res.status, 409)
  const body = await res.json()
  assert.equal(body.error.code, 'CONFLICT')
  assert.equal(body.error.message, 'Cette ressource existe déjà.')
})

test('Erreur Prisma P2025 normalisée en 404 RECORD_NOT_FOUND', async (t) => {
  const testApp = createTestApp()
  const server = testApp.listen(0)
  t.after(() => server.close())
  await once(server, 'listening')

  const res = await fetch(`http://localhost:${server.address().port}/test/prisma-not-found`)
  assert.equal(res.status, 404)
  const body = await res.json()
  assert.equal(body.error.code, 'RECORD_NOT_FOUND')
  assert.equal(body.error.message, 'Enregistrement introuvable.')
})

test('En production, les erreurs 500 ne fuient aucun secret ni stack', async (t) => {
  const oldEnv = process.env.NODE_ENV
  process.env.NODE_ENV = 'production'
  t.after(() => {
    process.env.NODE_ENV = oldEnv
  })

  const testApp = createTestApp()
  const server = testApp.listen(0)
  t.after(() => server.close())
  await once(server, 'listening')

  const res = await fetch(`http://localhost:${server.address().port}/test/unexpected`)
  assert.equal(res.status, 500)
  const body = await res.json()

  // Format strict sans fuite de secrets
  assert.equal(body.error.code, 'INTERNAL_SERVER_ERROR')
  assert.equal(body.error.message, 'Une erreur inattendue est survenue.')
  assert.equal(body.error.stack, undefined)
  assert.equal(body.error.details, undefined)
  assert.doesNotMatch(JSON.stringify(body), /secret de base de données/i)
})

test('En développement, une erreur inattendue expose le message et la stack de diagnostic', async (t) => {
  const oldEnv = process.env.NODE_ENV
  process.env.NODE_ENV = 'development'
  t.after(() => {
    process.env.NODE_ENV = oldEnv
  })

  const testApp = createTestApp()
  const server = testApp.listen(0)
  t.after(() => server.close())
  await once(server, 'listening')

  const originalError = console.error
  console.error = () => {}
  try {
    const res = await fetch(`http://localhost:${server.address().port}/test/unexpected`)
    assert.equal(res.status, 500)
    const body = await res.json()
    assert.equal(body.error.code, 'INTERNAL_SERVER_ERROR')
    assert.equal(body.error.message, 'Crash inattendu ou secret de base de données')
    assert.match(body.error.stack, /Crash inattendu/)
  } finally {
    console.error = originalError
  }
})

test('En production, une erreur attendue conserve code et message sans details ni stack', async (t) => {
  const oldEnv = process.env.NODE_ENV
  process.env.NODE_ENV = 'production'
  t.after(() => {
    process.env.NODE_ENV = oldEnv
  })

  const testApp = createTestApp()
  const server = testApp.listen(0)
  t.after(() => server.close())
  await once(server, 'listening')

  const res = await fetch(`http://localhost:${server.address().port}/test/operational`)
  assert.equal(res.status, 400)
  const body = await res.json()
  assert.deepEqual(body, { error: { code: 'INVALID_PARAM', message: 'Paramètre invalide.' } })
})

test('En production, une route inexistante renvoie le format contractuel sans stack', async (t) => {
  const oldEnv = process.env.NODE_ENV
  process.env.NODE_ENV = 'production'
  t.after(() => {
    process.env.NODE_ENV = oldEnv
  })

  const testApp = createTestApp()
  const server = testApp.listen(0)
  t.after(() => server.close())
  await once(server, 'listening')

  const originalWarn = console.warn
  console.warn = () => {}
  try {
    const res = await fetch(`http://localhost:${server.address().port}/api/route-inexistante`)
    assert.equal(res.status, 404)
    const body = await res.json()
    assert.deepEqual(body, { error: { code: 'NOT_FOUND', message: 'Route introuvable.' } })
  } finally {
    console.warn = originalWarn
  }
})

test('Le journal d’une erreur inattendue contient les frames sans le message brut de l’exception', async (t) => {
  const testApp = createTestApp()
  const server = testApp.listen(0)
  t.after(() => server.close())
  await once(server, 'listening')

  const originalError = console.error
  let logOutput = ''
  console.error = (message) => {
    logOutput = message
  }

  try {
    const res = await fetch(`http://localhost:${server.address().port}/test/unexpected`)
    assert.equal(res.status, 500)
    assert.match(logOutput, /Erreur serveur inattendue/)
    assert.match(logOutput, /errors\.test\.js/)
    assert.doesNotMatch(logOutput, /secret de base de données/)
  } finally {
    console.error = originalError
  }
})

test('La fonction sanitize filtre les données sensibles dans les objets et métadonnées', () => {
  const input = {
    method: 'POST',
    url: '/api/login',
    headers: {
      authorization: 'Bearer super-secret-token',
      cookie: 'session_id=12345',
      accept: 'application/json',
    },
    body: {
      username: 'Alex',
      password: 'mon-mot-de-passe-secret',
      nested: {
        token: 'refresh-token-xyz',
        refresh_token: 'refresh-token-xyz',
        apiKey: 'api-key-xyz',
        publicInfo: 'visible',
      },
    },
  }

  const cleaned = sanitize(input)
  assert.equal(cleaned.headers.authorization, '[MASQUÉ]')
  assert.equal(cleaned.headers.cookie, '[MASQUÉ]')
  assert.equal(cleaned.headers.accept, 'application/json')
  assert.equal(cleaned.body.password, '[MASQUÉ]')
  assert.equal(cleaned.body.username, 'Alex')
  assert.equal(cleaned.body.nested.token, '[MASQUÉ]')
  assert.equal(cleaned.body.nested.refresh_token, '[MASQUÉ]')
  assert.equal(cleaned.body.nested.apiKey, '[MASQUÉ]')
  assert.equal(cleaned.body.nested.publicInfo, 'visible')
})

test('Un statut HTTP invalide est remplacé par une erreur 500', async (t) => {
  const testApp = express()
  testApp.get('/test/invalid-status', (req, res, next) => {
    const error = new Error('Status invalide')
    error.status = 200
    next(error)
  })
  testApp.use(notFoundHandler)
  testApp.use(errorHandler)

  const server = testApp.listen(0)
  t.after(() => server.close())
  await once(server, 'listening')

  const originalError = console.error
  console.error = () => {}
  try {
    const res = await fetch(`http://localhost:${server.address().port}/test/invalid-status`)
    assert.equal(res.status, 500)
    const body = await res.json()
    assert.equal(body.error.code, 'INTERNAL_SERVER_ERROR')
  } finally {
    console.error = originalError
  }
})
