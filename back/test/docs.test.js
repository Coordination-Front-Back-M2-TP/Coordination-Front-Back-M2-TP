import assert from 'node:assert/strict'
import { once } from 'node:events'
import { test } from 'node:test'
import { app } from '../src/app.js'

test('GET /api/openapi.json renvoie la spécification OpenAPI valide', async (t) => {
  const server = app.listen(0)
  t.after(() => server.close())
  await once(server, 'listening')

  const response = await fetch(`http://localhost:${server.address().port}/api/openapi.json`)

  assert.equal(response.status, 200)
  const spec = await response.json()
  assert.equal(spec.openapi, '3.0.3')
  assert.equal(spec.info.title, 'API P1X3L')
  assert.ok(spec.paths['/api/auth/register'])
  assert.ok(spec.paths['/api/teams'])
  assert.ok(spec.paths['/api/teams'].post)
  assert.equal(spec.paths['/api/teams'].get.responses['200'].content['application/json'].schema.properties.teams.maxItems, undefined)
  const responseSchema = (route, method) => spec.paths[`/api/moderation/${route}`][method].responses['200'].content['application/json'].schema
  assert.equal(responseSchema('cleanups', 'post').properties.action.$ref, '#/components/schemas/ZoneCleanupAction')
  assert.equal(responseSchema('bans', 'post').properties.action.$ref, '#/components/schemas/PlayerBanAction')
  assert.equal(responseSchema('actions', 'get').properties.actions.items.$ref, '#/components/schemas/ModerationAction')
  const { ModerationAction, ZoneCleanupAction, PlayerBanAction } = spec.components.schemas
  assert.deepEqual(ModerationAction.discriminator, {
    propertyName: 'type',
    mapping: {
      zone_cleanup: '#/components/schemas/ZoneCleanupAction',
      player_ban: '#/components/schemas/PlayerBanAction',
    },
  })
  assert.deepEqual(ZoneCleanupAction.allOf[1].properties.details.required, ['fromX', 'fromY', 'toX', 'toY', 'removedCount', 'revision'])
  assert.deepEqual(PlayerBanAction.allOf[1].properties.details.required, ['pseudo', 'restoredCount', 'clearedCount', 'revision'])
  assert.ok(spec.paths['/api/agent'])
  assert.ok(spec.paths['/api/health'])
  assert.ok(spec.paths['/api/rankings'])
  assert.ok(spec.paths['/api/pixels'])
  assert.ok(spec.paths['/api/placements'])
})

test('GET /api/docs/ répond avec l’interface Swagger UI', async (t) => {
  const server = app.listen(0)
  t.after(() => server.close())
  await once(server, 'listening')

  const response = await fetch(`http://localhost:${server.address().port}/api/docs/`)

  assert.equal(response.status, 200)
  const html = await response.text()
  assert.match(html, /swagger-ui/i)
})
