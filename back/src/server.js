import { createServer } from 'node:http'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Server } from 'socket.io'
import { createAccountService } from './accounts/account-service.js'
import { createApp } from './app.js'
import { canvasRepository } from './canvas/canvas-repository.js'
import { createCanvasService } from './canvas/canvas-service.js'
import { placementRepository as defaultPlacementRepository } from './placements/placement-repository.js'
import { createPlacementService } from './placements/placement-service.js'
import { createTeamService } from './teams/team-service.js'

const CANVAS_ROOM = 'canvas'

// cooldownMs : délai entre deux poses d'un compte ; par défaut, celui de PIXEL_COOLDOWN_SECONDS.
// placementRepository : accès à l'historique des poses ; les tests y passent leur propre base.
// accountRepository : accès aux comptes et aux sessions ; par défaut, celui de la base de l'application.
// teamRepository : accès à l'équipe des comptes ; teamChangeCooldownMs : délai entre deux changements d'équipe.
export function createCanvasServer({
  repository = canvasRepository,
  placementRepository = defaultPlacementRepository,
  accountRepository,
  teamRepository,
  teamChangeCooldownMs,
  resolvePlayer,
  cooldownMs,
} = {}) {
  let io
  const canvasService = createCanvasService({
    repository,
    cooldownMs,
    publish: (pixel) => io.to(CANVAS_ROOM).emit('pixel:updated', pixel),
  })
  const placementService = createPlacementService({ repository: placementRepository })
  const accountService = accountRepository ? createAccountService({ repository: accountRepository }) : undefined
  const teamService = teamRepository
    ? createTeamService({ repository: teamRepository, cooldownMs: teamChangeCooldownMs })
    : undefined
  const app = createApp({ canvasService, placementService, accountService, teamService, resolvePlayer })
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
  const { httpServer } = createCanvasServer()
  httpServer.listen(port, (error) => {
    if (error) throw error
    console.log(`Back P1X3L prêt : http://localhost:${port}/api/health`)
  })
}
