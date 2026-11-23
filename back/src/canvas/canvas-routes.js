import { Router } from 'express'
import { forbidden, unauthorized } from '../errors/app-error.js'

// Routes HTTP de la toile, montées sous /api par app.js. Contrat : docs/contrat-api.md.
// Elles lisent la requête et répondent ; les règles du jeu sont dans canvas-service.js.
export function createCanvasRouter({ canvasService, resolvePlayer }) {
  const router = Router()

  router.get('/pixels', async (req, res, next) => {
    try {
      res.json(await canvasService.getSnapshot())
    } catch (error) {
      next(error)
    }
  })

  // La session identifie le compte. L'équipe est confirmée dans la transaction de pose.
  router.post('/pixels', async (req, res, next) => {
    try {
      const player = await resolvePlayer(req)
      if (!player) throw unauthorized('Connectez-vous pour poser un pixel.')
      // Chaque pixel compte pour une équipe : sans équipe, pas de pose.
      if (player.teamId == null) throw forbidden('Choisissez une équipe avant de poser un pixel.', 'TEAM_REQUIRED')
      // Le délai est vérifié par le serveur : une pose trop tôt reçoit 429 COOLDOWN_ACTIVE et Retry-After.
      res.json(await canvasService.placePixel(req.body, {
        accountId: String(player.accountId),
        teamId: String(player.teamId),
        source: 'manual',
      }))
    } catch (error) {
      next(error)
    }
  })

  return router
}
