import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import swaggerUi from 'swagger-ui-express'

const __dirname = dirname(fileURLToPath(import.meta.url))
const openapiSpec = JSON.parse(readFileSync(join(__dirname, 'openapi.json'), 'utf8'))

// L'application est séparée du serveur : les tests la lancent sur un port libre, sans toucher au port 3000.
export const app = express()

// Permet au front, et à toute personne qui installe le projet, de vérifier que le back répond.
// version : le commit de l'image, gravé par la CD (APP_VERSION). « dev » hors image Docker.
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: process.env.APP_VERSION || 'dev' })
})

// Exposition de la spécification OpenAPI brute et de la documentation interactive Swagger UI.
app.get('/api/openapi.json', (req, res) => {
  res.json(openapiSpec)
})
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec))
