import express from 'express'

// L'application est séparée du serveur : les tests la lancent sur un port libre, sans toucher au port 3000.
export const app = express()

// Permet au front, et à toute personne qui installe le projet, de vérifier que le back répond.
// version : le commit de l'image, gravé par la CD (APP_VERSION). « dev » hors image Docker.
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: process.env.APP_VERSION || 'dev' })
})
