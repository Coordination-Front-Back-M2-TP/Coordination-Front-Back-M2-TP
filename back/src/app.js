import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import { errorHandler, notFoundHandler } from './middleware/error-handler.js'
import swaggerUi from 'swagger-ui-express'
import { sessionPlaceholder } from './auth/session-placeholder.js'
import { canvasRepository } from './canvas/canvas-repository.js'
import { createCanvasService } from './canvas/canvas-service.js'
import { badRequest } from './errors/app-error.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const openapiSpec = JSON.parse(readFileSync(join(__dirname, 'openapi.json'), 'utf8'))

const defaultCanvasService = createCanvasService({ repository: canvasRepository })

// L'application est séparée du serveur : les tests la lancent sur un port libre, sans toucher au port 3000.
export function createApp({ canvasService = defaultCanvasService, sessionMiddleware = sessionPlaceholder } = {}) {
  const app = express()

  // Analyse les corps de requête JSON
  app.use(express.json())

  // Permet au front, et à toute personne qui installe le projet, de vérifier que le back répond.
  // version : le commit de l'image, gravé par la CD (APP_VERSION). « dev » hors image Docker.
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', version: process.env.APP_VERSION || 'dev' })
  })

  app.get('/api/pixels', async (req, res, next) => {
    try {
      res.json(await canvasService.getSnapshot())
    } catch (error) {
      next(error)
    }
  })

  // Pose d'un pixel : la session (placeholder en attendant #18) fournit le
  // compte et l'équipe ; le client ne transmet ni l'un ni l'autre.
  app.post('/api/pixels', sessionMiddleware, async (req, res, next) => {
    try {
      const { accountId, teamId } = req.session
      const { pixel, cooldownEndsAt } = await canvasService.placePixel({
        x: req.body?.x,
        y: req.body?.y,
        color: req.body?.color,
        accountId,
        teamId,
      })
      res.json({ pixel, cooldownEndsAt })
    } catch (error) {
      if (error instanceof TypeError) {
        next(badRequest('Coordonnées ou couleur invalides.', 'INVALID_INPUT'))
        return
      }
      next(error)
    }
  })

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
