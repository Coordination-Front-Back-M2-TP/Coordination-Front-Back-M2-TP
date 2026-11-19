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
  assert.ok(spec.paths['/api/moderation/cleanups'])
  assert.ok(spec.paths['/api/moderation/bans'])
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
