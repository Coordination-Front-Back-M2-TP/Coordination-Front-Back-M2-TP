import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import { errorHandler, notFoundHandler } from './middleware/error-handler.js'
import swaggerUi from 'swagger-ui-express'
import { canvasRepository } from './canvas/canvas-repository.js'
import { createCanvasRouter } from './canvas/canvas-routes.js'
import { createCanvasService } from './canvas/canvas-service.js'
import { placementRepository } from './placements/placement-repository.js'
import { createPlacementRouter } from './placements/placement-routes.js'
import { createPlacementService } from './placements/placement-service.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const openapiSpec = JSON.parse(readFileSync(join(__dirname, 'openapi.json'), 'utf8'))

const defaultCanvasService = createCanvasService({ repository: canvasRepository })
const defaultPlacementService = createPlacementService({ repository: placementRepository })

// Tant que l'authentification (#18) n'est pas livrée, aucune session n'est reconnue : la pose renvoie 401.
// L'authentification remplacera cette fonction par une lecture de la session, qui renvoie
// { accountId, teamId } pour un joueur connecté, ou null.
const noSession = async () => null

// L'application est séparée du serveur : les tests la lancent sur un port libre, sans toucher au port 3000.
export function createApp({
  canvasService = defaultCanvasService,
  placementService = defaultPlacementService,
  resolvePlayer = noSession,
} = {}) {
  const app = express()

  // Analyse les corps de requête JSON
  app.use(express.json())

  // Permet au front, et à toute personne qui installe le projet, de vérifier que le back répond.
  // version : le commit de l'image, gravé par la CD (APP_VERSION). « dev » hors image Docker.
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', version: process.env.APP_VERSION || 'dev' })
  })

  // Chaque fonctionnalité apporte ses routes (GUIDELINES.md, section 5).
  app.use('/api', createCanvasRouter({ canvasService, resolvePlayer }))
  app.use('/api', createPlacementRouter({ placementService }))

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
