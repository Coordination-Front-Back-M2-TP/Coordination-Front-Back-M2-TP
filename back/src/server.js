import { createServer } from 'node:http'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Server } from 'socket.io'
import { createApp } from './app.js'
import { canvasRepository, prisma } from './canvas/canvas-repository.js'
import { installProcessHandlers } from './process-handlers.js'
import { createCanvasService } from './canvas/canvas-service.js'

const CANVAS_ROOM = 'canvas'

export function createCanvasServer({ repository = canvasRepository, resolvePlayer } = {}) {
  let io
  const canvasService = createCanvasService({
    repository,
    publish: (pixel) => io.to(CANVAS_ROOM).emit('pixel:updated', pixel),
  })
  const app = createApp({ canvasService, resolvePlayer })
  const httpServer = createServer(app)
  io = new Server(httpServer)

  io.on('connection', (socket) => {
    socket.on('canvas:subscribe', async (acknowledge) => {
      try {
        await socket.join(CANVAS_ROOM)
        const snapshot = await canvasService.getSnapshot()
        if (typeof acknowledge === 'function') acknowledge(snapshot)
      } catch {
        await socket.leave(CANVAS_ROOM)
        socket.emit('canvas:error', {
          error: {
            code: 'BOARD_UNAVAILABLE',
            message: 'La toile est momentanément indisponible.',
          },
        })
      }
    })

    socket.on('canvas:unsubscribe', () => {
      socket.leave(CANVAS_ROOM)
    })
  })

  return { app, httpServer, io, canvasService }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  // Le front attend le back sur le port 3000 (proxy de front/vite.config.js).
  const port = Number(process.env.PORT) || 3000

  // Express 5 passe l'erreur d'écoute au callback : sans ce test, le back se dirait prêt.
  const { httpServer, io } = createCanvasServer()
  // Arrêt propre sur SIGTERM (docker stop) et arrêt journalisé en cas de plantage : voir process-handlers.js.
  installProcessHandlers({ httpServer, io, disconnect: () => prisma.$disconnect() })
  httpServer.listen(port, (error) => {
    if (error) throw error
    console.log(`Back P1X3L prêt : http://localhost:${port}/api/health`)
  })
}
