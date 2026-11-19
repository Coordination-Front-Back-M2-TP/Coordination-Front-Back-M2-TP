import { Router } from 'express'

// Routes HTTP de l'historique des poses, montées sous /api par app.js. Contrat : docs/contrat-api.md.
// Lecture publique, comme la toile : la réponse ne contient aucune identité de joueur.
export function createPlacementRouter({ placementService }) {
  const router = Router()

  router.get('/placements', async (req, res, next) => {
    try {
      res.json(await placementService.listByPeriod(req.query))
    } catch (error) {
      next(error)
    }
  })

  return router
}
