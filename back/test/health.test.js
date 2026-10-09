import assert from 'node:assert/strict'
import { once } from 'node:events'
import { test } from 'node:test'
import { app } from '../src/app.js'

test('GET /api/health répond { status: "ok" }', async (t) => {
  const server = app.listen(0)
  t.after(() => server.close())
  await once(server, 'listening')

  const response = await fetch(`http://localhost:${server.address().port}/api/health`)

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { status: 'ok' })
})
