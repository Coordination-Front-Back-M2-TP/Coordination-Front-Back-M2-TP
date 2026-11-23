import { createServer } from 'node:http'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Server } from 'socket.io'
import { createAccountService } from './accounts/account-service.js'
import { agentRepository as defaultAgentRepository } from './agents/agent-repository.js'
import { createAgentService } from './agents/agent-service.js'
import { createApp } from './app.js'
import { rankingRepository as defaultRankingRepository } from './rankings/ranking-repository.js'
import { createRankingService } from './rankings/ranking-service.js'
import { logger } from './utils/logger.js'
import { canvasRepository, prisma } from './canvas/canvas-repository.js'
import { installProcessHandlers } from './process-handlers.js'
import { createCanvasService } from './canvas/canvas-service.js'
import { moderationRepository as defaultModerationRepository } from './moderation/moderation-repository.js'
import { createModerationService } from './moderation/moderation-service.js'
import { placementRepository as defaultPlacementRepository } from './placements/placement-repository.js'
import { createPlacementService } from './placements/placement-service.js'
import { createTeamService } from './teams/team-service.js'

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
      // Le changement de toile est déjà enregistré et diffusé. Il reste valide si le classement échoue.
      logger.error('Diffusion du classement impossible', { errorName: error?.name })
    }
  }
}

// cooldownMs : délai entre deux poses d'un compte ; par défaut, celui de PIXEL_COOLDOWN_SECONDS.
// placementRepository : accès à l'historique des poses ; les tests y passent leur propre base.
// accountRepository : accès aux comptes et aux sessions ; par défaut, celui de la base de l'application.
// teamRepository : accès à l'équipe des comptes ; teamChangeCooldownMs : délai entre deux changements d'équipe.
// moderationRepository : nettoyage de zone, bannissement et journal ; rankingRepository : données du classement.
// agentRepository : agents de dessin ; agentIdleCheckMs : rythme de veille d'un agent qui a fini son modèle.
// Par défaut, ceux de la base de l'application, seulement avec le dépôt de toile par défaut :
// un test qui passe sa propre toile ne doit ni lire ni écrire dans une autre base.
export function createCanvasServer({
  repository = canvasRepository,
  placementRepository = defaultPlacementRepository,
  accountRepository,
  teamRepository,
  teamChangeCooldownMs,
  moderationRepository = repository === canvasRepository ? defaultModerationRepository : null,
  rankingRepository = repository === canvasRepository ? defaultRankingRepository : null,
  agentRepository = repository === canvasRepository ? defaultAgentRepository : null,
  agentIdleCheckMs,
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

  function publishCanvasChange(event, payload, affectsRanking = true) {
    io.to(CANVAS_ROOM).emit(event, payload)
    if (affectsRanking) broadcastRanking()
  }

  const canvasService = createCanvasService({
    repository,
    cooldownMs,
    publish: (pixel) => publishCanvasChange('pixel:updated', pixel),
  })
  const placementService = createPlacementService({ repository: placementRepository })
  const accountService = accountRepository ? createAccountService({ repository: accountRepository }) : undefined
  const teamService = teamRepository
    ? createTeamService({ repository: teamRepository, cooldownMs: teamChangeCooldownMs })
    : undefined
  const moderationService = moderationRepository
    ? createModerationService({
        repository: moderationRepository,
        publishCleanup: (cleanup, removedCount) => publishCanvasChange('canvas:cleared', cleanup, removedCount > 0),
        publishRevert: (revert) => publishCanvasChange('canvas:reverted', revert),
      })
    : undefined
  // L'agent pose par le service de toile : ses pixels sont diffusés comme ceux d'un joueur.
  const agentService = agentRepository
    ? createAgentService({ repository: agentRepository, canvasService, cooldownMs, idleCheckMs: agentIdleCheckMs })
    : null
  const app = createApp({
    canvasService,
    placementService,
    accountService,
    teamService,
    moderationService,
    rankingService,
    agentService,
    resolvePlayer,
  })
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

  return { app, httpServer, io, canvasService, rankingService, agentService }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  // Le front attend le back sur le port 3000 (proxy de front/vite.config.js).
  const port = Number(process.env.PORT) || 3000

  // Express 5 passe l'erreur d'écoute au callback : sans ce test, le back se dirait prêt.
  const { httpServer, io, agentService } = createCanvasServer()
  // Arrêt propre sur SIGTERM (docker stop) et arrêt journalisé en cas de plantage : voir process-handlers.js.
  // Les agents de dessin s'arrêtent avant la base : ils reprendront au prochain démarrage.
  installProcessHandlers({
    httpServer,
    io,
    disconnect: () => {
      agentService.shutdown()
      return prisma.$disconnect()
    },
  })
  httpServer.listen(port, (error) => {
    if (error) throw error
    // Les agents de dessin lancés avant l'arrêt du serveur reprennent leur modèle.
    agentService.resume().catch((resumeError) => {
      logger.error('Reprise des agents de dessin impossible', { errorName: resumeError?.name })
    })
    console.log(`Back P1X3L prêt : http://localhost:${port}/api/health`)
  })
}
