import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import { accountRepository } from './accounts/account-repository.js'
import { agentRepository } from './agents/agent-repository.js'
import { createAgentRouter } from './agents/agent-routes.js'
import { createAgentService } from './agents/agent-service.js'
import { createAccountRouter, createSessionPlayerResolver } from './accounts/account-routes.js'
import { createAccountService } from './accounts/account-service.js'
import { errorHandler, notFoundHandler } from './middleware/error-handler.js'
import { createModelProviders } from './models/model-providers.js'
import { modelRepository } from './models/model-repository.js'
import { createModelRouter } from './models/model-routes.js'
import { createModelService } from './models/model-service.js'
import { moderationRepository } from './moderation/moderation-repository.js'
import { createModerationRouter } from './moderation/moderation-routes.js'
import { createModerationService } from './moderation/moderation-service.js'
import swaggerUi from 'swagger-ui-express'
import { rankingRepository } from './rankings/ranking-repository.js'
import { createRankingRouter } from './rankings/ranking-routes.js'
import { createRankingService } from './rankings/ranking-service.js'
import { canvasRepository } from './canvas/canvas-repository.js'
import { createCanvasRouter } from './canvas/canvas-routes.js'
import { createCanvasService } from './canvas/canvas-service.js'
import { placementRepository } from './placements/placement-repository.js'
import { createPlacementRouter } from './placements/placement-routes.js'
import { createPlacementService } from './placements/placement-service.js'
import { teamRepository } from './teams/team-repository.js'
import { createTeamRouter } from './teams/team-routes.js'
import { createTeamService } from './teams/team-service.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const defaultRankingService = createRankingService({ repository: rankingRepository })
const openapiSpec = JSON.parse(readFileSync(join(__dirname, 'openapi.json'), 'utf8'))

const defaultCanvasService = createCanvasService({ repository: canvasRepository })
const defaultPlacementService = createPlacementService({ repository: placementRepository })

const defaultAccountService = createAccountService({ repository: accountRepository })
const defaultTeamService = createTeamService({ repository: teamRepository })
const defaultModerationService = createModerationService({ repository: moderationRepository })
const defaultAgentService = createAgentService({ repository: agentRepository, canvasService: defaultCanvasService })
const defaultModelService = createModelService({ repository: modelRepository, providers: createModelProviders() })

// L'application est séparée du serveur : les tests la lancent sur un port libre, sans toucher au port 3000.
// resolvePlayer : lit le joueur de la requête, { accountId, teamId } ou null. Par défaut, il vient
// du cookie de session ; les tests peuvent passer une session factice.
// agentService : l'agent de dessin. Par défaut, celui de la base de l'application, seulement avec
// la toile par défaut ; null le retire : un test qui passe sa propre toile ne doit pas lire une autre base.
export function createApp({
  canvasService = defaultCanvasService,
  placementService = defaultPlacementService,
  accountService = defaultAccountService,
  teamService = defaultTeamService,
  moderationService = defaultModerationService,
  rankingService = defaultRankingService,
  agentService = canvasService === defaultCanvasService ? defaultAgentService : null,
  modelService = accountService === defaultAccountService ? defaultModelService : null,
  resolvePlayer = createSessionPlayerResolver(accountService),
} = {}) {
  const app = express()

  if (modelService) {
    app.use('/api/models', (req, res, next) => {
      res.set('Cache-Control', 'no-store')
      next()
    })
  }

  // Analyse les corps de requête JSON
  app.use(express.json())

  // Permet au front, et à toute personne qui installe le projet, de vérifier que le back répond.
  // version : le commit de l'image, gravé par la CD (APP_VERSION). « dev » hors image Docker.
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', version: process.env.APP_VERSION || 'dev' })
  })

  // Chaque fonctionnalité apporte ses routes (GUIDELINES.md, section 5).
  app.use('/api', createAccountRouter({ accountService }))
  app.use('/api', createTeamRouter({ teamService, accountService }))
  app.use('/api', createModerationRouter({ moderationService, accountService }))
  if (agentService) app.use('/api', createAgentRouter({ agentService, accountService }))
  if (modelService) app.use('/api', createModelRouter({ modelService, accountService }))
  app.use('/api', createCanvasRouter({
    canvasService,
    resolvePlayer,
  }))
  app.use('/api', createPlacementRouter({ placementService }))

  app.use('/api', createRankingRouter({ rankingService }))

  // Exposition de la spécification OpenAPI brute et de la documentation interactive Swagger UI.
  app.get('/api/openapi.json', (req, res) => {
    res.json(openapiSpec)
  })
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec))

  // Gestion des routes inexistantes (404)
  app.use(notFoundHandler)

  // Middleware centralisé de traitement des erreurs (doit être le dernier middleware)
  app.use(errorHandler)

  return app
}

export const app = createApp()
