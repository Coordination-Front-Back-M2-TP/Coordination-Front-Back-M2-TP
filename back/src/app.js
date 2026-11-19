import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import { errorHandler, notFoundHandler } from './middleware/error-handler.js'
import { unauthorized } from './errors/app-error.js'
import swaggerUi from 'swagger-ui-express'
import { canvasRepository } from './canvas/canvas-repository.js'
import { createCanvasService } from './canvas/canvas-service.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const openapiSpec = JSON.parse(readFileSync(join(__dirname, 'openapi.json'), 'utf8'))

const defaultCanvasService = createCanvasService({ repository: canvasRepository })

// Tant que l'authentification (#18) n'est pas livrée, aucune session n'est reconnue : la pose renvoie 401.
// L'authentification remplacera cette fonction par une lecture de la session, qui renvoie
// { accountId, teamId } pour un joueur connecté, ou null.
const noSession = async () => null

// L'application est séparée du serveur : les tests la lancent sur un port libre, sans toucher au port 3000.
export function createApp({ canvasService = defaultCanvasService, resolvePlayer = noSession } = {}) {
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

  // Pose d'un pixel : compte requis. Le compte et l'équipe viennent de la session, jamais du corps.
  app.post('/api/pixels', async (req, res, next) => {
    try {
      const player = await resolvePlayer(req)
      if (!player) throw unauthorized('Connectez-vous pour poser un pixel.')

      const pixel = await canvasService.savePixel(req.body, {
        accountId: String(player.accountId),
        teamId: String(player.teamId),
      })
      // Le délai (#22) n'est pas encore appliqué : le joueur peut reposer tout de suite.
      res.json({ pixel, cooldownEndsAt: pixel.updatedAt })
    } catch (error) {
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
