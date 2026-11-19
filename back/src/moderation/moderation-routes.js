import { Router } from 'express'
import { ADMIN_ROLE } from '../accounts/account-service.js'
import { readSessionToken } from '../accounts/session-cookie.js'
import { forbidden, unauthorized } from '../errors/app-error.js'

// Routes HTTP de modération, montées sous /api par app.js. Contrat : docs/contrat-api.md.
// Toutes demandent un compte admin : le rôle est relu dans la base à chaque requête, jamais dans le corps.
export function createModerationRouter({ moderationService, accountService }) {
  const router = Router()

  async function requireAdmin(req) {
    const account = await accountService.getAccount(readSessionToken(req))
    if (!account) throw unauthorized('Connectez-vous avec un compte admin.')
    if (account.role !== ADMIN_ROLE) throw forbidden('Cette action est réservée aux admins.')
    return account
  }

  router.post('/moderation/cleanups', async (req, res, next) => {
    try {
      const admin = await requireAdmin(req)
      res.json(await moderationService.cleanZone(req.body, admin))
    } catch (error) {
      next(error)
    }
  })

  router.get('/moderation/players', async (req, res, next) => {
    try {
      await requireAdmin(req)
      res.json(await moderationService.listPlayers(req.query))
    } catch (error) {
      next(error)
    }
  })

  router.post('/moderation/bans', async (req, res, next) => {
    try {
      const admin = await requireAdmin(req)
      res.json(await moderationService.banPlayer(req.body, admin))
    } catch (error) {
      next(error)
    }
  })

  router.get('/moderation/actions', async (req, res, next) => {
    try {
      await requireAdmin(req)
      res.json(await moderationService.listActions(req.query))
    } catch (error) {
      next(error)
    }
  })

  return router
}
