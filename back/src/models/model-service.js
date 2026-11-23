import { randomUUID } from 'node:crypto'
import { AppError, badRequest, conflict, internalError, tooManyRequests } from '../errors/app-error.js'
import { readModelGrid } from './model-grid.js'

const DAILY_LIMIT = 5
const MAX_PROMPT_LENGTH = 500
const RESERVATION_DURATION_MS = 120_000
const MODERATION_PROVIDERS = ['jev', 'openai']

function utcPeriod(at) {
  const day = at.toISOString().slice(0, 10)
  const nextMidnight = new Date(at)
  nextMidnight.setUTCHours(24, 0, 0, 0)
  return { day, nextMidnight }
}

function readRequest(body) {
  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : ''
  if (!prompt || [...prompt].length > MAX_PROMPT_LENGTH || !MODERATION_PROVIDERS.includes(body.moderationProvider)) {
    throw badRequest('La consigne ou le service de modération n’est pas accepté.', 'INVALID_INPUT')
  }
  return { prompt, provider: body.moderationProvider }
}

export function createModelService({ repository, providers, now = () => new Date() }) {
  const moderationProviders = providers.generate
    ? MODERATION_PROVIDERS.filter((provider) => typeof providers.moderation[provider] === 'function')
    : []

  async function quotaFor(accountId) {
    const { day, nextMidnight } = utcPeriod(now())
    const used = await repository.countUsed(accountId, day)
    return { limit: DAILY_LIMIT, remaining: Math.max(0, DAILY_LIMIT - used), resetsAt: nextMidnight.toISOString() }
  }

  return {
    async getQuota(accountId) {
      return { quota: await quotaFor(accountId), moderationProviders }
    },

    async generateModel(accountId, body) {
      const { prompt, provider } = readRequest(body)
      if (!moderationProviders.includes(provider)) throw internalError('La génération est indisponible avec ce service.')

      const acceptedAt = now()
      const { day, nextMidnight } = utcPeriod(acceptedAt)
      const token = randomUUID()
      const expiresAt = new Date(acceptedAt.getTime() + RESERVATION_DURATION_MS)
      const status = await repository.reserve({ accountId, day, now: acceptedAt, expiresAt, token, limit: DAILY_LIMIT })
      if (status === 'busy') throw conflict('Une génération est déjà en cours.', 'MODEL_REQUEST_IN_PROGRESS')
      if (status === 'exhausted') {
        const retryAfterSeconds = Math.max(1, Math.ceil((nextMidnight.getTime() - now().getTime()) / 1000))
        throw tooManyRequests('Votre quota de modèles est épuisé.', 'MODEL_QUOTA_EXHAUSTED', retryAfterSeconds)
      }

      try {
        const approved = await providers.moderation[provider](prompt)
        if (approved === false) {
          throw new AppError('Cette consigne a été refusée par le filtre du jeu.', { statusCode: 422, code: 'PROMPT_REJECTED' })
        }
        if (approved !== true) throw internalError('Le service de modération n’a pas autorisé la génération.')

        const model = readModelGrid(await providers.generate(prompt))
        if (!await repository.consume({ accountId, day, token, now: now() })) {
          throw internalError('La réservation de cette génération a expiré.')
        }
        return { model, quota: await quotaFor(accountId) }
      } finally {
        await repository.release(accountId, token)
      }
    },
  }
}
