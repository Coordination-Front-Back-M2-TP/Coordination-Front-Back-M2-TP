import { createServer } from 'node:http'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Server } from 'socket.io'
import { createApp } from './app.js'
import { rankingRepository as defaultRankingRepository } from './rankings/ranking-repository.js'
import { createRankingService } from './rankings/ranking-service.js'
import { logger } from './utils/logger.js'
import { canvasRepository } from './canvas/canvas-repository.js'
import { createCanvasService } from './canvas/canvas-service.js'
import { placementRepository as defaultPlacementRepository } from './placements/placement-repository.js'
import { createPlacementService } from './placements/placement-service.js'

const CANVAS_ROOM = 'canvas'

// Diffuse le classement aux abonnés de la toile après un changement de pixel.
// Rien n'est émis si le classement n'a pas bougé, ni s'il est plus ancien que le dernier émis :
// deux calculs lancés coup sur coup peuvent finir dans le désordre.
function createRankingBroadcaster({ rankingService, emit }) {
  let lastRevision = -1
  let lastTeams = null

  return async function broadcastRanking() {
    try {
      const ranking = await rankingService.getRanking()
      if (ranking.revision <= lastRevision) return
      const teams = JSON.stringify(ranking.teams)
      const changed = teams !== lastTeams
      lastRevision = ranking.revision
      lastTeams = teams
      if (changed) emit(ranking)
    } catch (error) {
      // La pose est déjà enregistrée et diffusée : un classement en échec ne doit pas la faire échouer.
      logger.error('Diffusion du classement impossible', { errorName: error?.name })
    }
  }
}

// cooldownMs : délai entre deux poses d'un compte ; par défaut, celui de PIXEL_COOLDOWN_SECONDS.
// placementRepository : accès à l'historique des poses ; les tests y passent leur propre base.
// rankingRepository : accès aux données du classement. Par défaut, celui de la base de l'application,
// seulement avec le dépôt de toile par défaut : un test qui passe sa propre toile ne doit pas lire une autre base.
export function createCanvasServer({
  repository = canvasRepository,
  placementRepository = defaultPlacementRepository,
  rankingRepository = repository === canvasRepository ? defaultRankingRepository : null,
  resolvePlayer,
  cooldownMs,
} = {}) {
  let io
  const rankingService = rankingRepository ? createRankingService({ repository: rankingRepository }) : undefined
  const broadcastRanking = rankingService
    ? createRankingBroadcaster({
        rankingService,
        emit: (ranking) => io.to(CANVAS_ROOM).emit('ranking:updated', ranking),
      })
    : () => {}
  const canvasService = createCanvasService({
    repository,
    cooldownMs,
    publish: (pixel) => {
      io.to(CANVAS_ROOM).emit('pixel:updated', pixel)
      broadcastRanking()
    },
  })
  const placementService = createPlacementService({ repository: placementRepository })
  const app = createApp({ canvasService, placementService, rankingService, resolvePlayer })
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

  return { app, httpServer, io, canvasService, rankingService }
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
