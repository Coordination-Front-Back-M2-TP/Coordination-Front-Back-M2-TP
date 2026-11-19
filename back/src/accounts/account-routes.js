import { Router } from 'express'
import { unauthorized } from '../errors/app-error.js'
import { toUser } from './account-service.js'
import { clearSessionCookie, readSessionToken, setSessionCookie } from './session-cookie.js'

// Lit la session de la requête pour la pose d'un pixel : { accountId, teamId }, ou null sans session valide.
// teamId est null tant que le joueur n'a pas d'équipe (#41).
export function createSessionPlayerResolver(accountService) {
  return async function resolvePlayer(req) {
    const account = await accountService.getAccount(readSessionToken(req))
    return account ? { accountId: account.id, teamId: null } : null
  }
}

// Routes HTTP des comptes, montées sous /api par app.js. Contrat : docs/contrat-api.md.
// Elles lisent la requête, posent ou effacent le cookie et répondent ; les règles sont dans account-service.js.
export function createAccountRouter({ accountService }) {
  const router = Router()

  router.post('/auth/register', async (req, res, next) => {
    try {
      const { user, session } = await accountService.register(req.body)
      setSessionCookie(res, session)
      res.status(201).json({ user })
    } catch (error) {
      next(error)
    }
  })

  router.post('/auth/login', async (req, res, next) => {
    try {
      const { user, session } = await accountService.login(req.body)
      setSessionCookie(res, session)
      res.json({ user })
    } catch (error) {
      next(error)
    }
  })

  // Sans session, la réponse est la même : se déconnecter deux fois n'est pas une erreur.
  router.post('/auth/logout', async (req, res, next) => {
    try {
      await accountService.logout(readSessionToken(req))
      clearSessionCookie(res)
      res.status(204).end()
    } catch (error) {
      next(error)
    }
  })

  router.get('/auth/me', async (req, res, next) => {
    try {
      const account = await accountService.getAccount(readSessionToken(req))
      if (!account) throw unauthorized('Vous n’êtes pas connecté.')
      res.json({ user: toUser(account) })
    } catch (error) {
      next(error)
    }
  })

  return router
}
