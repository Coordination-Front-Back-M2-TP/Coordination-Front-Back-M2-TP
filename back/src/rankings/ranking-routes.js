import { Router } from 'express'

// Routes HTTP du classement des équipes, montées sous /api par app.js. Contrat : docs/contrat-api.md.
// Lecture publique, comme la toile : le classement ne contient aucune identité de joueur.
export function createRankingRouter({ rankingService }) {
  const router = Router()

  router.get('/rankings', async (req, res, next) => {
    try {
      res.json(await rankingService.getRanking())
    } catch (error) {
      next(error)
    }
  })

  return router
}
