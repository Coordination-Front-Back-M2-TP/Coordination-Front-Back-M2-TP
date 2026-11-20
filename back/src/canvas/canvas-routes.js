import { Router } from 'express'
import { conflict, forbidden, unauthorized } from '../errors/app-error.js'

// Routes HTTP de la toile, montées sous /api par app.js. Contrat : docs/contrat-api.md.
// Elles lisent la requête et répondent ; les règles du jeu sont dans canvas-service.js.
// isAgentActive (facultatif) : dit si l'agent de dessin d'un compte travaille.
export function createCanvasRouter({ canvasService, resolvePlayer, isAgentActive = null }) {
  const router = Router()

  router.get('/pixels', async (req, res, next) => {
    try {
      res.json(await canvasService.getSnapshot())
    } catch (error) {
      next(error)
    }
  })

  // Pose d'un pixel : compte requis. Le compte et l'équipe viennent de la session, jamais du corps.
  router.post('/pixels', async (req, res, next) => {
    try {
      const player = await resolvePlayer(req)
      if (!player) throw unauthorized('Connectez-vous pour poser un pixel.')
      // Chaque pixel compte pour une équipe : sans équipe, pas de pose.
      if (player.teamId == null) throw forbidden('Choisissez une équipe avant de poser un pixel.', 'TEAM_REQUIRED')
      // Un compte, un délai : pendant que l'agent travaille, le joueur ne pose pas à la main.
      if (isAgentActive && await isAgentActive(player.accountId)) {
        throw conflict('Votre agent de dessin travaille : arrêtez-le pour poser à la main.', 'AGENT_ACTIVE')
      }

      // Le délai est vérifié par le serveur : une pose trop tôt reçoit 429 COOLDOWN_ACTIVE et Retry-After.
      res.json(await canvasService.placePixel(req.body, {
        accountId: String(player.accountId),
        teamId: String(player.teamId),
      }))
    } catch (error) {
      next(error)
    }
  })

  return router
}
