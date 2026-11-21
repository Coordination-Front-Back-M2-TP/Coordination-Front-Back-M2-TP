import { createServer } from 'node:http'
import { Server } from 'socket.io'

const CANVAS_WIDTH = 101
const CANVAS_HEIGHT = 101

// Pixels seedés : couleurs distinctes autour de l'origine, connues des tests.
export const SEED_PIXELS = [
  { x: -2, y: -2, color: '#D93A3A' },
  { x: 2, y: -2, color: '#2563EB' },
  { x: -2, y: 2, color: '#16A34A' },
  { x: 2, y: 2, color: '#EAB308' },
  { x: 0, y: 0, color: '#9333EA' },
]

// Serveur Socket.IO « contrat » : il implémente docs/contrat-api.md (instantané,
// abonnement, diffusion, lecture HTTP) sans persistance, le temps que le vrai
// back de la toile (#35) existe. Il sera remplacé par ce back à sa livraison.
export function createContractServer() {
  let revision = 0
  const pixels = new Map()
  for (const seed of SEED_PIXELS) {
    revision += 1
    pixels.set(`${seed.x},${seed.y}`, { ...seed, revision, updatedAt: new Date().toISOString() })
  }
  const handshakes = []

  const snapshot = () => ({
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    revision,
    snapshotAt: new Date().toISOString(),
    pixels: [...pixels.values()],
  })

  // Le proxy Vite envoie aussi /api vers ce serveur : santé et lecture HTTP du contrat.
  const httpServer = createServer((request, response) => {
    const body = request.url === '/api/health'
      ? { status: 'ok' }
      : request.url === '/api/pixels'
        ? snapshot()
        : { error: { code: 'NOT_FOUND', message: 'Route inconnue.' } }
    response.writeHead(request.url === '/api/health' || request.url === '/api/pixels' ? 200 : 404, {
      'Content-Type': 'application/json',
    })
    response.end(JSON.stringify(body))
  })

  const io = new Server(httpServer)
  io.on('connection', (socket) => {
    handshakes.push(socket.handshake)
    socket.on('canvas:subscribe', (acknowledge) => acknowledge?.(snapshot()))
    socket.on('canvas:unsubscribe', () => {})
  })

  return {
    handshakes,
    listen: (port) => new Promise((resolve) => httpServer.listen(port, resolve)),
    close: () => new Promise((resolve) => io.close(resolve)),
    // Simule un pixel posé ailleurs : enregistré puis diffusé, comme le contrat l'exige.
    placePixel({ x, y, color }) {
      revision += 1
      const pixel = { x, y, color, revision, updatedAt: new Date().toISOString() }
      pixels.set(`${x},${y}`, pixel)
      io.emit('pixel:updated', pixel)
      return pixel
    },
    cleanZone({ fromX, fromY, toX, toY }, admin) {
      let removedCount = 0
      for (const [key, { x, y }] of pixels) {
        if (x < fromX || x > toX || y < fromY || y > toY) continue
        pixels.delete(key)
        removedCount += 1
      }
      revision += 1
      const createdAt = new Date().toISOString()
      const zone = { fromX, fromY, toX, toY, revision }
      io.emit('canvas:cleared', { ...zone, clearedAt: createdAt })
      return { action: { id: 1, type: 'zone_cleanup', admin, createdAt, details: { ...zone, removedCount } } }
    },
  }
}
