import { Router } from 'express'
import { readSessionToken } from '../accounts/session-cookie.js'
import { unauthorized } from '../errors/app-error.js'

// Routes HTTP de l'agent de dessin, montées sous /api par app.js. Contrat : docs/contrat-api.md.
// L'agent est celui du compte de la session, jamais d'un compte nommé dans la requête.
export function createAgentRouter({ agentService, accountService }) {
  const router = Router()

  async function requireAccount(req) {
    const account = await accountService.getAccount(readSessionToken(req))
    if (!account) throw unauthorized('Connectez-vous pour utiliser votre agent de dessin.')
    return account
  }

  router.get('/agent', async (req, res, next) => {
    try {
      res.json(await agentService.getAgent(await requireAccount(req)))
    } catch (error) {
      next(error)
    }
  })

  router.post('/agent', async (req, res, next) => {
    try {
      const account = await requireAccount(req)
      res.status(201).json(await agentService.startAgent(req.body, account))
    } catch (error) {
      next(error)
    }
  })

  router.delete('/agent', async (req, res, next) => {
    try {
      await agentService.stopAgent(await requireAccount(req))
      res.status(204).end()
    } catch (error) {
      next(error)
    }
  })

  return router
}
