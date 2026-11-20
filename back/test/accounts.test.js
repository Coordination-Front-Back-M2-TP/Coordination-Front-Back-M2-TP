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
import { createAccountService, readSessionTtlMs } from '../src/accounts/account-service.js'
import { hashPassword, verifyPassword } from '../src/accounts/password.js'
import { createCanvasRepository } from '../src/canvas/canvas-repository.js'
import { createCanvasServer } from '../src/server.js'
import { createTeamRepository } from '../src/teams/team-repository.js'

const backDirectory = fileURLToPath(new URL('../', import.meta.url))
const databasePath = join(backDirectory, 'prisma', `test-accounts-${process.pid}.db`)
const databaseUrl = `file:./prisma/test-accounts-${process.pid}.db`
const { PrismaClient } = prismaClient
// Mot de passe fictif, propre aux tests.
const PASSWORD = 'mot-de-passe-de-test'
let prisma
let server
let baseUrl

function startServer() {
  return createCanvasServer({
    repository: createCanvasRepository(prisma),
    accountRepository: createAccountRepository(prisma),
    teamRepository: createTeamRepository(prisma),
    cooldownMs: 0,
  })
}

before(async () => {
  execFileSync(process.execPath, [join(backDirectory, 'scripts', 'prisma.js'), 'migrate', 'deploy'], {
    cwd: backDirectory,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'pipe',
  })
  prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: databaseUrl }) })
  server = startServer()
  server.httpServer.listen(0)
  await once(server.httpServer, 'listening')
  baseUrl = `http://localhost:${server.httpServer.address().port}`
})

after(async () => {
  if (server) await new Promise((resolve) => server.io.close(resolve))
  if (prisma) await prisma.$disconnect()
  for (const suffix of ['', '-journal', '-shm', '-wal']) await rm(`${databasePath}${suffix}`, { force: true })
})

function request(path, { method = 'GET', body, cookie, url = baseUrl } = {}) {
  return fetch(`${url}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(cookie ? { cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

// Le cookie de session posé par une réponse : son texte complet, et la paire « nom=valeur » à renvoyer.
function sessionCookie(response) {
  const raw = response.headers.getSetCookie().find((cookie) => cookie.startsWith('p1x3l_session='))
  return raw ? { raw, pair: raw.split(';')[0] } : null
}

async function register(pseudo, password = PASSWORD) {
  const response = await request('/api/auth/register', { method: 'POST', body: { pseudo, password } })
  assert.equal(response.status, 201)
  return { body: await response.json(), cookie: sessionCookie(response) }
}

test('l’inscription crée le compte, connecte le joueur et ne renvoie que son pseudo et son équipe', async () => {
  const { body, cookie } = await register('Alex')
  assert.deepEqual(body, { user: { pseudo: 'Alex', team: null, role: 'player' } })

  assert.match(cookie.raw, /; HttpOnly/i)
  assert.match(cookie.raw, /; SameSite=Lax/i)
  assert.match(cookie.raw, /; Path=\//i)
  assert.match(cookie.raw, /; Expires=/i)
  assert.doesNotMatch(cookie.raw, /; Secure/i)

  const me = await request('/api/auth/me', { cookie: cookie.pair })
  assert.equal(me.status, 200)
  assert.deepEqual(await me.json(), { user: { pseudo: 'Alex', team: null, role: 'player' } })
})

test('le mot de passe est stocké haché avec son sel, jamais en clair', async () => {
  await register('Hache')
  await register('Hache2')
  const [first, second] = await prisma.account.findMany({
    where: { pseudoKey: { in: ['hache', 'hache2'] } },
    orderBy: { id: 'asc' },
  })
  for (const account of [first, second]) {
    assert.match(account.passwordHash, /^scrypt\$\d+\$\d+\$\d+\$[^$]+\$[^$]+$/)
    assert.equal(account.passwordHash.includes(PASSWORD), false)
  }
  // Même mot de passe, sels différents : les empreintes ne se ressemblent pas.
  assert.notEqual(first.passwordHash, second.passwordHash)
  assert.equal(await verifyPassword(PASSWORD, first.passwordHash), true)
  assert.equal(await verifyPassword(`${PASSWORD}!`, first.passwordHash), false)
})

test('le jeton de session n’est pas stocké en clair', async () => {
  const { cookie } = await register('Jeton')
  const token = cookie.pair.split('=')[1]
  assert.match(token, /^[A-Za-z0-9_-]{43}$/)
  const sessions = await prisma.session.findMany()
  assert.equal(sessions.some((session) => session.tokenHash === token), false)
  assert.equal(sessions.every((session) => /^[0-9a-f]{64}$/.test(session.tokenHash)), true)
})

test('le pseudo est unique, sans tenir compte de la casse', async () => {
  await register('Unique')
  for (const pseudo of ['Unique', 'unique', 'UNIQUE', '  Unique  ']) {
    const response = await request('/api/auth/register', { method: 'POST', body: { pseudo, password: PASSWORD } })
    assert.equal(response.status, 409, pseudo)
    assert.equal((await response.json()).error.code, 'PSEUDO_TAKEN')
    assert.equal(sessionCookie(response), null)
  }
  assert.equal(await prisma.account.count({ where: { pseudoKey: 'unique' } }), 1)
})

test('deux inscriptions simultanées avec le même pseudo : une seule passe', async () => {
  const responses = await Promise.all(['Course', 'course'].map((pseudo) => (
    request('/api/auth/register', { method: 'POST', body: { pseudo, password: PASSWORD } })
  )))
  assert.deepEqual(responses.map((response) => response.status).sort(), [201, 409])
  assert.equal(await prisma.account.count({ where: { pseudoKey: 'course' } }), 1)
})

test('refuse en 400 INVALID_INPUT un pseudo ou un mot de passe hors contrat, sans créer de compte', async () => {
  const before = await prisma.account.count()
  const invalid = [
    {},
    [],
    { pseudo: 'Valide' },
    { password: PASSWORD },
    { pseudo: 'ab', password: PASSWORD },
    { pseudo: 'a'.repeat(21), password: PASSWORD },
    { pseudo: 'avec espace', password: PASSWORD },
    { pseudo: 'accentué', password: PASSWORD },
    { pseudo: '<script>', password: PASSWORD },
    { pseudo: 42, password: PASSWORD },
    { pseudo: 'Valide', password: 'court' },
    { pseudo: 'Valide', password: 'a'.repeat(129) },
    { pseudo: 'Valide', password: 12345678 },
  ]
  for (const body of invalid) {
    const response = await request('/api/auth/register', { method: 'POST', body })
    assert.equal(response.status, 400, JSON.stringify(body))
    assert.equal((await response.json()).error.code, 'INVALID_INPUT')
    assert.equal(sessionCookie(response), null)
  }
  assert.equal(await prisma.account.count(), before)
})

test('la connexion ouvre une session avec le bon mot de passe, quelle que soit la casse du pseudo', async () => {
  await register('Marin')
  for (const pseudo of ['Marin', 'marin']) {
    const response = await request('/api/auth/login', { method: 'POST', body: { pseudo, password: PASSWORD } })
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { user: { pseudo: 'Marin', team: null, role: 'player' } })
    const me = await request('/api/auth/me', { cookie: sessionCookie(response).pair })
    assert.equal(me.status, 200)
  }
})

test('un mot de passe faux et un pseudo inconnu reçoivent la même réponse 401', async () => {
  await register('Secret')
  const wrongPassword = await request('/api/auth/login', {
    method: 'POST',
    body: { pseudo: 'Secret', password: 'pas-le-bon-mot-de-passe' },
  })
  const unknownPseudo = await request('/api/auth/login', {
    method: 'POST',
    body: { pseudo: 'Inconnu', password: PASSWORD },
  })
  const tooLong = await request('/api/auth/login', {
    method: 'POST',
    body: { pseudo: 'Secret', password: 'a'.repeat(5000) },
  })
  for (const response of [wrongPassword, unknownPseudo, tooLong]) {
    assert.equal(response.status, 401)
    assert.equal(sessionCookie(response), null)
    const { error } = await response.json()
    assert.equal(error.code, 'INVALID_CREDENTIALS')
    assert.equal(error.message, 'Pseudo ou mot de passe incorrect.')
  }
})

test('la connexion refuse en 400 un corps sans pseudo ou sans mot de passe', async () => {
  for (const body of [{}, { pseudo: 'Marin' }, { password: PASSWORD }, { pseudo: 1, password: 2 }]) {
    const response = await request('/api/auth/login', { method: 'POST', body })
    assert.equal(response.status, 400, JSON.stringify(body))
    assert.equal((await response.json()).error.code, 'INVALID_INPUT')
  }
})

test('sans session, ou avec un cookie inconnu, /api/auth/me répond 401', async () => {
  const cookies = [undefined, 'p1x3l_session=inconnu', `p1x3l_session=${'a'.repeat(43)}`, 'autre=valeur']
  for (const cookie of cookies) {
    const response = await request('/api/auth/me', { cookie })
    assert.equal(response.status, 401, String(cookie))
    assert.equal((await response.json()).error.code, 'UNAUTHORIZED')
  }
})

test('la session survit au rechargement de la page et au redémarrage du serveur', async (t) => {
  const { cookie } = await register('Fidele')

  // Un autre serveur sur la même base, comme après un redémarrage.
  const restarted = startServer()
  restarted.httpServer.listen(0)
  await once(restarted.httpServer, 'listening')
  t.after(() => new Promise((resolve) => restarted.io.close(resolve)))
  const url = `http://localhost:${restarted.httpServer.address().port}`

  for (let reload = 0; reload < 2; reload += 1) {
    const me = await request('/api/auth/me', { cookie: cookie.pair, url })
    assert.equal(me.status, 200)
    assert.deepEqual(await me.json(), { user: { pseudo: 'Fidele', team: null, role: 'player' } })
  }
})

test('la déconnexion supprime la session et efface le cookie', async () => {
  const { cookie } = await register('Sortant')
  const sessionsBefore = await prisma.session.count()

  const response = await request('/api/auth/logout', { method: 'POST', cookie: cookie.pair })
  assert.equal(response.status, 204)
  assert.equal(await response.text(), '')
  assert.match(sessionCookie(response).raw, /^p1x3l_session=;/)
  assert.equal(await prisma.session.count(), sessionsBefore - 1)

  // Le cookie d'avant ne vaut plus rien, même si le navigateur le renvoie.
  assert.equal((await request('/api/auth/me', { cookie: cookie.pair })).status, 401)
})

test('se déconnecter sans session répond aussi 204', async () => {
  assert.equal((await request('/api/auth/logout', { method: 'POST' })).status, 204)
  assert.equal((await request('/api/auth/logout', { method: 'POST', cookie: 'p1x3l_session=inconnu' })).status, 204)
})

test('se déconnecter d’un appareil laisse les autres sessions du compte ouvertes', async () => {
  const first = await register('Mobile')
  const second = await request('/api/auth/login', { method: 'POST', body: { pseudo: 'Mobile', password: PASSWORD } })
  const secondCookie = sessionCookie(second).pair

  await request('/api/auth/logout', { method: 'POST', cookie: first.cookie.pair })
  assert.equal((await request('/api/auth/me', { cookie: first.cookie.pair })).status, 401)
  assert.equal((await request('/api/auth/me', { cookie: secondCookie })).status, 200)
})

test('une session expirée n’est plus reconnue et elle est supprimée', async () => {
  let clock = new Date('2026-11-01T10:00:00.000Z')
  const service = createAccountService({
    repository: createAccountRepository(prisma),
    now: () => clock,
    sessionTtlMs: 60_000,
  })
  const { session } = await service.register({ pseudo: 'Ephemere', password: PASSWORD })
  assert.equal(session.expiresAt.toISOString(), '2026-11-01T10:01:00.000Z')

  clock = new Date('2026-11-01T10:00:59.000Z')
  assert.equal((await service.getAccount(session.token)).pseudo, 'Ephemere')

  clock = new Date('2026-11-01T10:01:00.000Z')
  const sessionsBefore = await prisma.session.count()
  assert.equal(await service.getAccount(session.token), null)
  assert.equal(await prisma.session.count(), sessionsBefore - 1)
})

test('un joueur connecté pose un pixel, inscrit à son compte dans l’historique', async () => {
  const { cookie } = await register('Peintre')
  const account = await prisma.account.findUnique({ where: { pseudoKey: 'peintre' } })
  // Une équipe est obligatoire pour poser : voir teams.test.js.
  const joined = await request('/api/auth/me/team', { method: 'PUT', cookie: cookie.pair, body: { teamId: 'rouge' } })
  assert.equal(joined.status, 200)

  const response = await request('/api/pixels', {
    method: 'POST',
    cookie: cookie.pair,
    body: { x: 3, y: 4, color: '#123456' },
  })
  assert.equal(response.status, 200)
  const { pixel } = await response.json()

  const placement = await prisma.pixelPlacement.findUnique({ where: { revision: pixel.revision } })
  assert.equal(placement.accountId, String(account.id))
  assert.equal(placement.teamId, 'rouge')
})

test('sans session, ou après déconnexion, la pose est refusée en 401', async () => {
  const { cookie } = await register('Parti')
  await request('/api/auth/logout', { method: 'POST', cookie: cookie.pair })
  const before = await prisma.pixelPlacement.count()

  for (const sent of [undefined, cookie.pair]) {
    const response = await request('/api/pixels', {
      method: 'POST',
      cookie: sent,
      body: { x: 5, y: 5, color: '#123456' },
    })
    assert.equal(response.status, 401)
    assert.equal((await response.json()).error.code, 'UNAUTHORIZED')
  }
  assert.equal(await prisma.pixelPlacement.count(), before)
})

test('les réponses ne contiennent ni empreinte ni identifiant de compte, et un champ en trop est ignoré', async () => {
  const response = await request('/api/auth/register', {
    method: 'POST',
    body: { pseudo: 'Curieux', password: PASSWORD, id: 1, passwordHash: 'x', team: 'rouge' },
  })
  assert.equal(response.status, 201)
  const text = await response.text()
  assert.deepEqual(JSON.parse(text), { user: { pseudo: 'Curieux', team: null, role: 'player' } })
  assert.equal(text.includes('scrypt'), false)

  const account = await prisma.account.findUnique({ where: { pseudoKey: 'curieux' } })
  assert.notEqual(account.passwordHash, 'x')
})

test('en production, le cookie de session est marqué Secure', async (t) => {
  const previous = process.env.NODE_ENV
  process.env.NODE_ENV = 'production'
  t.after(() => {
    if (previous === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = previous
  })
  const { cookie } = await register('Prod')
  assert.match(cookie.raw, /; Secure/i)
})

test('hashPassword refuse de vérifier une empreinte d’un autre format', async () => {
  assert.equal(await verifyPassword(PASSWORD, 'en-clair'), false)
  assert.equal(await verifyPassword(PASSWORD, ''), false)
  assert.equal(await verifyPassword(PASSWORD, await hashPassword(PASSWORD)), true)
})

test('SESSION_TTL_DAYS règle la durée de la session, 30 jours par défaut', () => {
  const day = 24 * 60 * 60 * 1000
  assert.equal(readSessionTtlMs({}), 30 * day)
  assert.equal(readSessionTtlMs({ SESSION_TTL_DAYS: '7' }), 7 * day)
  assert.equal(readSessionTtlMs({ SESSION_TTL_DAYS: '0.5' }), day / 2)
  for (const value of ['', '  ', '0', '-1', 'abc']) {
    assert.equal(readSessionTtlMs({ SESSION_TTL_DAYS: value }), 30 * day, value)
  }
})
