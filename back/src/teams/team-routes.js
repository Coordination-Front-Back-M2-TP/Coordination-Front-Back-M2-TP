import { Router } from 'express'
import { toUser } from '../accounts/account-service.js'
import { readSessionToken } from '../accounts/session-cookie.js'
import { unauthorized } from '../errors/app-error.js'

// Routes HTTP des équipes, montées sous /api par app.js. Contrat : docs/contrat-api.md.
export function createTeamRouter({ teamService, accountService }) {
  const router = Router()

  // Lecture publique : la liste des équipes ne dépend pas du joueur.
  router.get('/teams', (req, res) => {
    res.json({ teams: teamService.listTeams() })
  })

  // Rejoindre ou changer d'équipe : compte requis. Le compte vient de la session, jamais du corps.
  router.put('/auth/me/team', async (req, res, next) => {
    try {
      const account = await accountService.getAccount(readSessionToken(req))
      if (!account) throw unauthorized('Connectez-vous pour choisir une équipe.')

      const result = await teamService.joinTeam(account, req.body)
      res.json({
        user: toUser(result.account),
        teamChangeAvailableAt: result.teamChangeAvailableAt.toISOString(),
      })
    } catch (error) {
      next(error)
    }
  })

  return router
}
