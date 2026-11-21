import { ADMIN_ROLE, PLAYER_ROLE } from '../accounts/account-service.js'
import { badRequest } from '../errors/app-error.js'

export const DEFAULT_PAGE_SIZE = 50
export const MAX_PAGE_SIZE = 200
const INTEGER_PATTERN = /^\d{1,9}$/
// Plus large que la règle d'inscription : il suffit d'écarter les valeurs qui ne sont pas un pseudo.
const MAX_PSEUDO_LENGTH = 64

// Un paramètre de requête absent donne fallback. Un paramètre répété arrive en tableau : il est refusé.
function readInteger(value, { min, max = Number.MAX_SAFE_INTEGER, fallback }) {
  if (value === undefined) return fallback
  if (typeof value !== 'string' || !INTEGER_PATTERN.test(value)) {
    throw badRequest('Cette page n’est pas acceptée.', 'INVALID_INPUT')
  }
  const number = Number(value)
  if (number < min || number > max) throw badRequest('Cette page n’est pas acceptée.', 'INVALID_INPUT')
  return number
}

// Un pseudo sert de clé sans tenir compte de la casse, comme à l'inscription.
function readPseudoKey(value, message) {
  if (typeof value !== 'string') throw badRequest(message, 'INVALID_INPUT')
  const pseudoKey = value.trim().toLowerCase()
  if (pseudoKey.length === 0 || pseudoKey.length > MAX_PSEUDO_LENGTH) throw badRequest(message, 'INVALID_INPUT')
  return pseudoKey
}

// Ce que l'API montre d'une action du journal : le pseudo de l'admin, jamais son identifiant de compte.
function toAction(record) {
  return {
    id: record.id,
    type: record.type,
    admin: record.adminPseudo,
    createdAt: record.createdAt,
    details: record.details,
  }
}

// Ce que l'API montre d'un compte à une admin : ni identifiant, ni empreinte du mot de passe.
function toPlayer(account) {
  return {
    pseudo: account.pseudo,
    team: account.team ?? null,
    role: account.role === ADMIN_ROLE ? ADMIN_ROLE : PLAYER_ROLE,
    banned: account.bannedAt !== null,
    bannedAt: account.bannedAt ? account.bannedAt.toISOString() : null,
  }
}

// publishCleanup : diffuse la zone nettoyée aux abonnés de la toile.
// publishRevert : diffuse les cases changées par un bannissement. Sans temps réel, ils ne font rien.
export function createModerationService({ repository, publishCleanup = () => {}, publishRevert = () => {} }) {
  return {
    // admin : le compte admin de la session. zone : le corps de la requête, deux coins inclus.
    async cleanZone(zone, admin) {
      if (!zone || typeof zone !== 'object'
        || ![zone.fromX, zone.fromY, zone.toX, zone.toY].every(Number.isSafeInteger)
        || zone.fromX > zone.toX || zone.fromY > zone.toY) {
        throw badRequest('Cette zone n’est pas acceptée.', 'INVALID_INPUT')
      }

      // Seuls les quatre coins sont gardés : un champ en trop dans le corps n'atteint pas la base.
      const record = await repository.cleanZone(
        { fromX: zone.fromX, fromY: zone.fromY, toX: zone.toX, toY: zone.toY },
        admin,
      )
      const { fromX, fromY, toX, toY, revision } = record.details
      // La diffusion vient après la transaction : elle n'annonce jamais un nettoyage qui a échoué.
      publishCleanup({ fromX, fromY, toX, toY, revision, clearedAt: record.createdAt })
      return { action: toAction(record) }
    },

    // admin : le compte admin de la session. body : le corps de la requête, { pseudo }.
    async banPlayer(body, admin) {
      const pseudoKey = readPseudoKey(body?.pseudo, 'Ce pseudo n’est pas accepté.')
      const { action, restored, cleared } = await repository.banPlayer(pseudoKey, admin)

      // Rien à diffuser quand le joueur n'avait aucun pixel visible. L'événement ne dit pas qui est banni.
      if (restored.length > 0 || cleared.length > 0) {
        publishRevert({ revision: action.details.revision, revertedAt: action.createdAt, restored, cleared })
      }
      return { action: toAction(action) }
    },

    // query : les paramètres de la requête, tels qu'Express les lit (des chaînes).
    async listPlayers(query = {}) {
      const after = query.after === undefined ? null : readPseudoKey(query.after, 'Cette page n’est pas acceptée.')
      const limit = readInteger(query.limit, { min: 1, max: MAX_PAGE_SIZE, fallback: DEFAULT_PAGE_SIZE })

      // Un compte de plus que la page : sa présence dit s'il reste une page.
      const accounts = await repository.listPlayers({ after, limit: limit + 1 })
      const players = accounts.slice(0, limit).map(toPlayer)
      const nextCursor = accounts.length > limit ? players.at(-1).pseudo : null
      return { players, nextCursor }
    },

    // query : les paramètres de la requête, tels qu'Express les lit (des chaînes).
    async listActions(query = {}) {
      const before = readInteger(query.before, { min: 1, fallback: null })
      const limit = readInteger(query.limit, { min: 1, max: MAX_PAGE_SIZE, fallback: DEFAULT_PAGE_SIZE })

      // Une action de plus que la page : sa présence dit s'il reste une page.
      const records = await repository.listActions({ before, limit: limit + 1 })
      const actions = records.slice(0, limit).map(toAction)
      const nextCursor = records.length > limit ? actions.at(-1).id : null
      return { actions, nextCursor }
    },
  }
}
