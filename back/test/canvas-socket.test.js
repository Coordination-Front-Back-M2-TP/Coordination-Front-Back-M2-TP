import assert from 'node:assert/strict'
import { EventEmitter, once } from 'node:events'
import { createServer } from 'node:http'
import { test } from 'node:test'
import { io as connect } from 'socket.io-client'
import { createApp } from '../src/app.js'
import { attachCanvasSocket } from '../src/realtime/canvas-socket.js'
import { createCanvasStore } from '../src/services/canvas-store.js'

async function startServer(t, store = createCanvasStore()) {
  const server = createServer(createApp(store))
  const io = attachCanvasSocket(server, store)
  server.listen(0)
  t.after(async () => {
    await new Promise((resolve) => io.close(resolve))
  })
  await once(server, 'listening')
  return { io, store, address: `http://localhost:${server.address().port}` }
}

async function connectClient(t, address) {
  const client = connect(address, { transports: ['websocket'], reconnection: false })
  t.after(() => client.close())
  await once(client, 'connect')
  return client
}

function waitForEvent(socket, event, timeoutMs = 2000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`événement « ${event} » non reçu`)), timeoutMs)
    socket.once(event, (payload) => {
      clearTimeout(timer)
      resolve(payload)
    })
  })
}

async function assertNoEvent(socket, event, durationMs = 300) {
  await assert.rejects(waitForEvent(socket, event, durationMs), /non reçu/)
}

function assertSnapshotShape(snapshot) {
  assert.deepEqual(Object.keys(snapshot).sort(), ['height', 'pixels', 'revision', 'snapshotAt', 'width'])
  assert.equal(snapshot.width, 101)
  assert.equal(snapshot.height, 101)
  assert.ok(Number.isSafeInteger(snapshot.revision))
  assert.ok(Number.isFinite(Date.parse(snapshot.snapshotAt)))
  assert.ok(Array.isArray(snapshot.pixels))
}

test('canvas:subscribe sans authentification renvoie l’instantané complet en ACK', async (t) => {
  const { io, address } = await startServer(t)
  let handshake
  io.on('connection', (socket) => {
    handshake = socket.handshake
  })
  const client = await connectClient(t, address)

  const snapshot = await client.emitWithAck('canvas:subscribe')

  assertSnapshotShape(snapshot)
  assert.equal(snapshot.revision, 0)
  assert.deepEqual(snapshot.pixels, [])
  assert.deepEqual(handshake.auth, {})
  assert.equal(handshake.headers.authorization, undefined)
})

test('l’ACK d’abonnement contient les pixels déjà posés', async (t) => {
  const { store, address } = await startServer(t)
  const premier = store.placePixel({ x: 12, y: 8, color: '#D93A3A' })
  const deuxieme = store.placePixel({ x: -50, y: 50, color: '#2563EB' })
  const client = await connectClient(t, address)

  const snapshot = await client.emitWithAck('canvas:subscribe')

  assertSnapshotShape(snapshot)
  assert.equal(snapshot.revision, 2)
  assert.deepEqual(snapshot.pixels, [premier, deuxieme])
})

test('un pixel enregistré est diffusé aux abonnés après persistance, en moins d’une seconde', async (t) => {
  const { store, address } = await startServer(t)
  const client = await connectClient(t, address)
  const snapshot = await client.emitWithAck('canvas:subscribe')
  assert.equal(snapshot.revision, 0)

  const startedAt = performance.now()
  const attendu = store.placePixel({ x: -1, y: 1, color: '#D93A3A' })
  const recu = await waitForEvent(client, 'pixel:updated')
  const latenceMs = performance.now() - startedAt

  assert.deepEqual(recu, attendu)
  assert.deepEqual(Object.keys(recu).sort(), ['color', 'revision', 'updatedAt', 'x', 'y'])
  // Le pixel annoncé est déjà persisté quand l’événement arrive.
  assert.deepEqual(store.getSnapshot().pixels, [recu])
  assert.ok(latenceMs < 1000, `diffusion trop lente : ${latenceMs} ms`)
})

test('les révisions diffusées sont strictement croissantes et sans doublon', async (t) => {
  const { store, address } = await startServer(t)
  const client = await connectClient(t, address)
  await client.emitWithAck('canvas:subscribe')
  const evenements = []
  client.on('pixel:updated', (pixel) => evenements.push(pixel))

  store.placePixel({ x: 0, y: 0, color: '#D93A3A' })
  store.placePixel({ x: 1, y: 0, color: '#2563EB' })
  store.placePixel({ x: 0, y: 0, color: '#22C55E' })
  store.placePixel({ x: 0, y: 1, color: '#FACC15' })

  await new Promise((resolve, reject) => {
    const echeance = Date.now() + 2000
    const verification = () => {
      if (evenements.length === 4) return resolve()
      if (Date.now() > echeance) return reject(new Error('4 événements pixel:updated attendus'))
      setTimeout(verification, 10)
    }
    verification()
  })
  assert.deepEqual(evenements.map((pixel) => pixel.revision), [1, 2, 3, 4])
})

test('un socket non abonné ne reçoit pas pixel:updated', async (t) => {
  const { store, address } = await startServer(t)
  const abonne = await connectClient(t, address)
  const spectateur = await connectClient(t, address)
  await abonne.emitWithAck('canvas:subscribe')

  store.placePixel({ x: 5, y: 5, color: '#D93A3A' })

  await waitForEvent(abonne, 'pixel:updated')
  await assertNoEvent(spectateur, 'pixel:updated')
})

test('canvas:unsubscribe arrête la diffusion pour ce socket', async (t) => {
  const { store, address } = await startServer(t)
  const client = await connectClient(t, address)
  await client.emitWithAck('canvas:subscribe')
  client.emit('canvas:unsubscribe')
  await new Promise((resolve) => setTimeout(resolve, 100))

  store.placePixel({ x: 5, y: 5, color: '#D93A3A' })

  await assertNoEvent(client, 'pixel:updated')
})

test('la déconnexion ferme l’abonnement', async (t) => {
  const { io, store, address } = await startServer(t)
  const coteServeur = new Promise((resolve) => {
    io.on('connection', (socket) => resolve(socket))
  })
  const client = await connectClient(t, address)
  const socketServeur = await coteServeur
  await client.emitWithAck('canvas:subscribe')
  assert.equal(io.sockets.adapter.rooms.get('canvas')?.size, 1)

  const deconnexion = once(socketServeur, 'disconnect')
  client.close()
  await deconnexion

  assert.equal(io.sockets.adapter.rooms.get('canvas'), undefined)
  // La diffusion continue de fonctionner pour les abonnés restants.
  const autre = await connectClient(t, address)
  await autre.emitWithAck('canvas:subscribe')
  const attendu = store.placePixel({ x: 2, y: 2, color: '#2563EB' })
  assert.deepEqual(await waitForEvent(autre, 'pixel:updated'), attendu)
})

test('canvas:error signale un échec de lecture, sans stack ni détail interne', async (t) => {
  const storeEnPanne = {
    events: new EventEmitter(),
    getSnapshot() {
      throw new Error('détail interne à ne pas divulguer')
    },
  }
  const { address } = await startServer(t, storeEnPanne)
  const client = await connectClient(t, address)

  const originalError = console.error
  console.error = () => {}
  let payload
  try {
    client.emit('canvas:subscribe')
    payload = await waitForEvent(client, 'canvas:error')
  } finally {
    console.error = originalError
  }

  assert.deepEqual(payload, {
    error: {
      code: 'BOARD_UNAVAILABLE',
      message: 'La toile est momentanément indisponible.',
    },
  })
  assert.doesNotMatch(JSON.stringify(payload), /stack|détail interne/)
})

test('un abonné qui se réabonne reçoit un instantané complet actualisé', async (t) => {
  const { store, address } = await startServer(t)
  const client = await connectClient(t, address)
  await client.emitWithAck('canvas:subscribe')
  const pixel = store.placePixel({ x: 7, y: -3, color: '#22C55E' })
  await waitForEvent(client, 'pixel:updated')

  const snapshot = await client.emitWithAck('canvas:subscribe')

  assertSnapshotShape(snapshot)
  assert.equal(snapshot.revision, 1)
  assert.deepEqual(snapshot.pixels, [pixel])
})
