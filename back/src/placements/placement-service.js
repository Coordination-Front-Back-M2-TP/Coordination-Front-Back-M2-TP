import { badRequest } from '../errors/app-error.js'

export const DEFAULT_PAGE_SIZE = 500
export const MAX_PAGE_SIZE = 1000
// Date ISO 8601 complète, avec son fuseau : une date sans fuseau dépendrait de l'heure locale du serveur.
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/
const INTEGER_PATTERN = /^\d{1,9}$/

function invalidInput() {
  return badRequest('Cette période ou cette page n’est pas acceptée.', 'INVALID_INPUT')
}

// Un paramètre absent vaut null. Un paramètre répété arrive en tableau : il est refusé.
function readDate(value) {
  if (value === undefined) return null
  if (typeof value !== 'string' || !ISO_DATE_PATTERN.test(value)) throw invalidInput()
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw invalidInput()
  return date
}

function readInteger(value, { min, max = Number.MAX_SAFE_INTEGER, fallback }) {
  if (value === undefined) return fallback
  if (typeof value !== 'string' || !INTEGER_PATTERN.test(value)) throw invalidInput()
  const number = Number(value)
  if (number < min || number > max) throw invalidInput()
  return number
}

export function createPlacementService({ repository }) {
  return {
    // query : les paramètres de la requête, tels qu'Express les lit (des chaînes).
    async listByPeriod(query = {}) {
      const from = readDate(query.from)
      const to = readDate(query.to)
      if (from && to && from.getTime() >= to.getTime()) throw invalidInput()
      const after = readInteger(query.after, { min: 0, fallback: null })
      const limit = readInteger(query.limit, { min: 1, max: MAX_PAGE_SIZE, fallback: DEFAULT_PAGE_SIZE })

      // Une pose de plus que la page : sa présence dit s'il reste une page, sans compter toute la table.
      const records = await repository.findByPeriod({ from, to, after, limit: limit + 1 })
      const placements = records.slice(0, limit)
      const nextCursor = records.length > limit ? placements.at(-1).revision : null
      return { placements, nextCursor }
    },
  }
}
