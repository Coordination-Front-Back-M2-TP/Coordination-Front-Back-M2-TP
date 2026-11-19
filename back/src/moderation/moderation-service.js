import { badRequest } from '../errors/app-error.js'

const MIN_COORDINATE = -50
const MAX_COORDINATE = 50
export const DEFAULT_PAGE_SIZE = 50
export const MAX_PAGE_SIZE = 200
const INTEGER_PATTERN = /^\d{1,9}$/

function isCoordinate(value) {
  return Number.isSafeInteger(value) && value >= MIN_COORDINATE && value <= MAX_COORDINATE
}

// Un paramètre de requête absent donne fallback. Un paramètre répété arrive en tableau : il est refusé.
function readInteger(value, { min, max = Number.MAX_SAFE_INTEGER, fallback }) {
  if (value === undefined) return fallback
  if (typeof value !== 'string' || !INTEGER_PATTERN.test(value)) {
    throw badRequest('Cette page du journal n’est pas acceptée.', 'INVALID_INPUT')
  }
  const number = Number(value)
  if (number < min || number > max) throw badRequest('Cette page du journal n’est pas acceptée.', 'INVALID_INPUT')
  return number
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

// publishCleanup : diffuse la zone nettoyée aux abonnés de la toile. Sans temps réel, il ne fait rien.
export function createModerationService({ repository, publishCleanup = () => {} }) {
  return {
    // admin : le compte admin de la session. zone : le corps de la requête, deux coins inclus.
    async cleanZone(zone, admin) {
      if (!zone || typeof zone !== 'object'
        || ![zone.fromX, zone.fromY, zone.toX, zone.toY].every(isCoordinate)
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
