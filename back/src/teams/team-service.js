import { PALETTE_COLORS } from '../canvas/palette.js'
import { badRequest, conflict, forbidden, notFound, tooManyRequests, unauthorized } from '../errors/app-error.js'

const PALETTE = new Set(PALETTE_COLORS)

function readTeam(body) {
  if (!body || typeof body.name !== 'string' || typeof body.color !== 'string') {
    throw badRequest('Ce nom ou cette couleur n’est pas accepté.', 'INVALID_INPUT')
  }
  const name = body.name.trim()
  const color = body.color.toUpperCase()
  if ([...name].length < 3 || [...name].length > 20 || !/^[\p{L}\p{M}\p{N} _-]+$/u.test(name) || !PALETTE.has(color)) {
    throw badRequest('Ce nom ou cette couleur n’est pas accepté.', 'INVALID_INPUT')
  }
  const id = name.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '-')
  return { id, name, color }
}

// Durée décidée dans le besoin (docs/besoin.md) : au plus un changement toutes les 5 minutes, réglable.
const DEFAULT_TEAM_CHANGE_COOLDOWN_SECONDS = 300

// Lit le délai entre deux changements d'équipe dans TEAM_CHANGE_COOLDOWN_SECONDS. Une valeur absente,
// vide, négative ou illisible donne le délai par défaut ; 0 désactive le délai.
export function readTeamChangeCooldownMs(env = process.env) {
  const raw = env.TEAM_CHANGE_COOLDOWN_SECONDS
  const seconds = raw === undefined || String(raw).trim() === '' ? Number.NaN : Number(raw)
  return Math.round(
    (Number.isFinite(seconds) && seconds >= 0 ? seconds : DEFAULT_TEAM_CHANGE_COOLDOWN_SECONDS) * 1000,
  )
}

export function createTeamService({ repository, now = () => new Date(), cooldownMs = readTeamChangeCooldownMs() }) {
  function availableAt(account) {
    return new Date(account.teamChangedAt.getTime() + cooldownMs)
  }

  return {
    listTeams: () => repository.listTeams(),

    async createTeam(account, body) {
      if (account.bannedAt) throw forbidden('Ce compte est banni.', 'ACCOUNT_BANNED')
      const team = readTeam(body)
      const changedAt = now()
      let changed
      try {
        changed = await repository.createAndJoin({ accountId: account.id, team, changedAt, changedBefore: new Date(changedAt.getTime() - cooldownMs) })
      } catch (error) {
        if (error?.code === 'P2002') throw conflict('Ce nom d’équipe est déjà pris.', 'TEAM_NAME_TAKEN')
        throw error
      }
      const current = await repository.findAccount(account.id)
      if (!current) throw unauthorized('Vous n’êtes pas connecté.')
      if (!changed) {
        if (current.bannedAt) throw forbidden('Ce compte est banni.', 'ACCOUNT_BANNED')
        const remainingMs = availableAt(current).getTime() - changedAt.getTime()
        throw tooManyRequests('Vous devez attendre avant de changer à nouveau d’équipe.', 'TEAM_CHANGE_COOLDOWN', Math.max(1, Math.ceil(remainingMs / 1000)))
      }
      return { team, account: current, teamChangeAvailableAt: availableAt(current) }
    },

    // account : le compte de la session. Renvoie { account, teamChangeAvailableAt }, le compte à jour
    // et l'heure serveur à partir de laquelle il pourra changer d'équipe.
    async joinTeam(account, body) {
      if (!body || typeof body !== 'object' || typeof body.teamId !== 'string') {
        throw badRequest('Cette équipe n’est pas acceptée.', 'INVALID_INPUT')
      }
      const team = await repository.findTeam(body.teamId)
      if (!team) throw notFound('Cette équipe n’existe pas.', 'TEAM_NOT_FOUND')

      // Redemander son équipe ne change rien et ne relance pas le délai.
      if (account.teamId === team.id) {
        return { account, teamChangeAvailableAt: availableAt(account) }
      }

      const changedAt = now()
      const changed = await repository.changeTeam({
        accountId: account.id,
        teamId: team.id,
        changedAt,
        changedBefore: new Date(changedAt.getTime() - cooldownMs),
      })
      const current = await repository.findAccount(account.id)
      // Le compte a pu être supprimé entre la lecture de la session et l'écriture.
      if (!current) throw unauthorized('Vous n’êtes pas connecté.')
      if (!changed) {
        const remainingMs = availableAt(current).getTime() - changedAt.getTime()
        throw tooManyRequests(
          'Vous devez attendre avant de changer à nouveau d’équipe.',
          'TEAM_CHANGE_COOLDOWN',
          Math.max(1, Math.ceil(remainingMs / 1000)),
        )
      }
      return { account: current, teamChangeAvailableAt: availableAt(current) }
    },
  }
}
