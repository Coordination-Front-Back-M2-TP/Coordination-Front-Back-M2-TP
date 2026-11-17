import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import { errorHandler, notFoundHandler } from './middleware/error-handler.js'
import { createPixelsRouter } from './routes/pixels.js'
import { canvasStore } from './services/canvas-store.js'
import swaggerUi from 'swagger-ui-express'

const __dirname = dirname(fileURLToPath(import.meta.url))
const openapiSpec = JSON.parse(readFileSync(join(__dirname, 'openapi.json'), 'utf8'))

// Fabrique d'application : les tests injectent un stockage de toile neuf, sans partager
// l'état de l'instance par défaut.
export function createApp(store = canvasStore) {
  const app = express()

  // Analyse les corps de requête JSON
  app.use(express.json())

  // Permet au front, et à toute personne qui installe le projet, de vérifier que le back répond.
  // version : le commit de l'image, gravé par la CD (APP_VERSION). « dev » hors image Docker.
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', version: process.env.APP_VERSION || 'dev' })
  })

  // Instantané public de la toile (docs/contrat-api.md).
  app.use('/api/pixels', createPixelsRouter(store))

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

// L'application est séparée du serveur : les tests la lancent sur un port libre, sans toucher au port 3000.
export const app = createApp()
