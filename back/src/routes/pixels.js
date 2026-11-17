import { Router } from 'express'

// GET /api/pixels : instantané courant de la toile, public, au format de docs/contrat-api.md.
export function createPixelsRouter(store) {
  const router = Router()

  router.get('/', (req, res, next) => {
    try {
      res.json(store.getSnapshot())
    } catch (error) {
      next(error)
    }
  })

  return router
}
