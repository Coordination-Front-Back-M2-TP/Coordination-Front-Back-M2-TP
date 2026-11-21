import { createServer } from 'node:http'
import { Server } from 'socket.io'
import { io } from 'socket.io-client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createServer as createViteServer } from 'vite'
import viteConfig from '../../vite.config.js'
import { subscribeCanvas } from './canvas.js'

const date = '2026-10-27T14:30:00.000Z'
const pixel = (revision = 1) => ({ x: -1, y: 1, color: '#D93A3A', revision, updatedAt: date })
const snapshot = (revision = 0, pixels = []) => ({ width: 101, height: 101, revision, snapshotAt: date, pixels })
let server
let address
let stop

beforeEach(async () => {
  const http = createServer()
  server = new Server(http)
  await new Promise((resolve) => http.listen(0, '127.0.0.1', resolve))
  address = `http://127.0.0.1:${http.address().port}`
})

afterEach(async () => {
  stop?.()
  stop = undefined
  await new Promise((resolve) => server.close(resolve))
})

function watch(onChange) {
  stop = subscribeCanvas(onChange, {
    createSocket: () => io(address, {
      autoConnect: false,
      transports: ['websocket'],
      reconnectionDelay: 10,
      reconnectionDelayMax: 20,
      randomizationFactor: 0,
    }),
  })
}

it('affiche les pixels existants sans compte et reçoit un changement en moins d’une seconde', async () => {
  let handshake
  let current
  let receivedAt
  server.on('connection', (socket) => {
    handshake = socket.handshake
    socket.on('canvas:subscribe', (acknowledge) => acknowledge(snapshot(1, [pixel()])))
  })
  watch((state) => { current = state; receivedAt = performance.now() })
  await vi.waitFor(() => expect(current?.status).toBe('live'))
  expect(handshake.auth).toEqual({})
  expect(handshake.headers.authorization).toBeUndefined()
  expect(current.canvas.pixels.get('-1,1').revision).toBe(1)

  const startedAt = performance.now()
  server.emit('pixel:updated', { ...pixel(2), color: '#2563EB' })
  await vi.waitFor(() => expect(current.canvas.pixels.get('-1,1').color).toBe('#2563EB'))
  expect(receivedAt - startedAt).toBeLessThan(1000)
})

it('ne perd pas un changement reçu avant l’ACK d’un vrai serveur Socket.IO', async () => {
  let current
  server.on('connection', (socket) => {
    socket.on('canvas:subscribe', (acknowledge) => {
      socket.emit('pixel:updated', pixel(2))
      acknowledge(snapshot(1))
    })
  })
  watch((state) => { current = state })
  await vi.waitFor(() => expect(current?.status).toBe('live'))
  expect(current.canvas.pixels.get('-1,1').revision).toBe(2)
})

it('restaure ou vide les cases au bannissement, en conservant les poses plus récentes', async () => {
  const restored = { ...pixel(1), color: '#2563EB' }
  const cleared = { x: 0, y: 1 }
  const newer = { ...pixel(7), x: 1 }
  let current
  server.on('connection', (socket) => {
    socket.on('canvas:subscribe', (acknowledge) => {
      socket.emit('canvas:reverted', { revision: 5, revertedAt: date, restored: [restored], cleared: [cleared] })
      acknowledge(snapshot(3, [pixel(2), { ...pixel(3), ...cleared }]))
    })
  })
  watch((state) => { current = state })
  await vi.waitFor(() => expect(current?.status).toBe('live'))
  expect([...current.canvas.pixels.values()]).toEqual([restored])

  server.emit('pixel:updated', pixel(4))
  server.emit('pixel:updated', { ...pixel(4), ...cleared })
  server.emit('pixel:updated', newer)
  server.emit('canvas:reverted', { revision: 6, revertedAt: date, restored: [], cleared: [newer] })
  server.emit('pixel:updated', { ...pixel(8), x: 2 })
  await vi.waitFor(() => expect(current.canvas.revision).toBe(8))
  expect([...current.canvas.pixels.values()]).toEqual([restored, newer, { ...pixel(8), x: 2 }])

  server.emit('canvas:cleared', { fromX: -1, fromY: 1, toX: -1, toY: 1, revision: 10, clearedAt: date })
  server.emit('canvas:reverted', { revision: 9, revertedAt: date, restored: [restored], cleared: [] })
  server.emit('pixel:updated', { ...pixel(11), x: 3 })
  await vi.waitFor(() => expect(current.canvas.revision).toBe(11))
  expect(current.canvas.pixels.has('-1,1')).toBe(false)
})

it('resynchronise un instantané complet après une vraie coupure de transport', async () => {
  let current
  let socket
  let connections = 0
  const statuses = []
  server.on('connection', (client) => {
    socket = client
    connections += 1
    client.on('canvas:subscribe', (acknowledge) => acknowledge(
      connections === 1 ? snapshot(1, [pixel()]) : snapshot(5),
    ))
  })
  watch((state) => { current = state; statuses.push(state.status) })
  await vi.waitFor(() => expect(current?.status).toBe('live'))
  socket.conn.close()
  await vi.waitFor(() => expect(current?.canvas?.revision).toBe(5))
  expect(statuses).toContain('reconnecting')
  expect(current.status).toBe('live')
  expect(current.canvas.pixels.size).toBe(0)
})

it('fait passer le polling et le passage à WebSocket par le proxy Vite de même origine', async () => {
  let current
  let client
  server.on('connection', (socket) => {
    socket.on('canvas:subscribe', (acknowledge) => acknowledge(snapshot()))
  })
  const proxy = await createViteServer({
    ...viteConfig,
    configFile: false,
    root: new URL('../..', import.meta.url).pathname,
    server: {
      ...viteConfig.server,
      host: '127.0.0.1',
      port: 0,
      proxy: {
        ...viteConfig.server.proxy,
        '/socket.io': { ...viteConfig.server.proxy['/socket.io'], target: address },
      },
    },
  })
  try {
    await proxy.listen()
    const origin = `http://127.0.0.1:${proxy.httpServer.address().port}`
    stop = subscribeCanvas((state) => { current = state }, {
      createSocket: () => {
        client = io(origin, { autoConnect: false, transports: ['polling', 'websocket'] })
        return client
      },
    })
    await vi.waitFor(() => expect(current?.status).toBe('live'))
    await vi.waitFor(() => expect(client.io.engine.transport.name).toBe('websocket'))
    server.emit('pixel:updated', pixel())
    await vi.waitFor(() => expect(current.canvas.pixels.get('-1,1').revision).toBe(1))
  } finally {
    stop?.()
    stop = undefined
    await proxy.close()
  }
})
