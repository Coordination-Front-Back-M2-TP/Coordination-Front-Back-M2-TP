import { Router } from 'express'
import { readSessionToken } from '../accounts/session-cookie.js'
import { unauthorized } from '../errors/app-error.js'

export function createModelRouter({ modelService, accountService }) {
  const router = Router()

  async function accountId(req) {
    const account = await accountService.getAccount(readSessionToken(req))
    if (!account) throw unauthorized('Connectez-vous pour demander un modèle.')
    return account.id
  }

  router.get('/models/quota', async (req, res) => {
    res.json(await modelService.getQuota(await accountId(req)))
  })

  router.post('/models', async (req, res) => {
    res.json(await modelService.generateModel(await accountId(req), req.body))
  })

  return router
}
