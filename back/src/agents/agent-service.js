import { readCooldownMs } from '../canvas/canvas-service.js'
import { badRequest, conflict, forbidden } from '../errors/app-error.js'
import { logger } from '../utils/logger.js'

const MIN_COORDINATE = -50
const MAX_COORDINATE = 50
const COLOR_PATTERN = /^#[0-9a-f]{6}$/i
// Taille d'un modèle : 32 × 32 pixels au plus (docs/besoin.md).
export const MAX_MODEL_SIZE = 32
// Quand le modèle est fini, l'agent regarde la toile à ce rythme pour réparer un pixel écrasé.
const DEFAULT_IDLE_CHECK_MS = 1000
// Attente avant de réessayer quand la pose est refusée pour un délai encore actif.
const COOLDOWN_RETRY_MS = 250

function isCoordinate(value) {
  return Number.isSafeInteger(value) && value >= MIN_COORDINATE && value <= MAX_COORDINATE
}

function cellKey({ x, y }) {
  return `${x},${y}`
}

// Le rectangle qui contient tout le modèle, coins inclus.
function boundsOf(pixels) {
  const xs = pixels.map(({ x }) => x)
  const ys = pixels.map(({ y }) => y)
  return { fromX: Math.min(...xs), fromY: Math.min(...ys), toX: Math.max(...xs), toY: Math.max(...ys) }
}

// Lit le modèle du corps de la requête : des pixels déjà placés sur la toile.
// Seuls x, y et color sont gardés : un champ en trop n'atteint pas la base.
function readModel(body) {
  const invalid = () => badRequest('Ce modèle n’est pas accepté.', 'INVALID_INPUT')
  const pixels = body?.pixels
  if (!Array.isArray(pixels) || pixels.length === 0 || pixels.length > MAX_MODEL_SIZE * MAX_MODEL_SIZE) throw invalid()

  const cells = new Set()
  const model = pixels.map((pixel) => {
    if (!pixel || typeof pixel !== 'object'
      || !isCoordinate(pixel.x) || !isCoordinate(pixel.y)
      || typeof pixel.color !== 'string' || !COLOR_PATTERN.test(pixel.color)
      || cells.has(cellKey(pixel))) {
      throw invalid()
    }
    cells.add(cellKey(pixel))
    return { x: pixel.x, y: pixel.y, color: pixel.color.toUpperCase() }
  })
  const { fromX, fromY, toX, toY } = boundsOf(model)
  if (toX - fromX >= MAX_MODEL_SIZE || toY - fromY >= MAX_MODEL_SIZE) throw invalid()
  return model
}

// Les pixels du modèle que la toile ne montre pas encore, dans l'ordre du modèle.
function findMissingPixels(model, visiblePixels) {
  const visible = new Map(visiblePixels.map((pixel) => [cellKey(pixel), pixel.color.toUpperCase()]))
  return model.filter((pixel) => visible.get(cellKey(pixel)) !== pixel.color)
}

// L'agent de dessin : un programme du serveur, sans IA. À chaque fin de délai du compte, il compare
// le modèle et la toile et pose le premier pixel qui ne correspond pas. Il continue quand le joueur
// est déconnecté, et il reste en veille une fois le modèle fini, pour réparer un pixel écrasé.
// canvasService : la pose passe par lui, avec les mêmes règles qu'une pose à la main.
// cooldownMs : délai entre deux poses du compte. idleCheckMs : rythme de veille. now : horloge du serveur.
export function createAgentService({
  repository,
  canvasService,
  cooldownMs = readCooldownMs(),
  idleCheckMs = DEFAULT_IDLE_CHECK_MS,
  now = () => new Date(),
}) {
  // Un minuteur par compte, et l'heure prévue de sa prochaine pose.
  const timers = new Map()
  const nextPlacements = new Map()
  let closed = false

  function forget(accountId) {
    clearTimeout(timers.get(accountId))
    timers.delete(accountId)
    nextPlacements.delete(accountId)
  }

  function schedule(accountId, delayMs) {
    clearTimeout(timers.get(accountId))
    if (closed) return
    const timer = setTimeout(() => runTick(accountId), Math.max(0, delayMs))
    // Un agent en attente ne doit pas empêcher le serveur de s'arrêter.
    timer.unref()
    timers.set(accountId, timer)
  }

  function scheduleNextPlacement(accountId, delayMs) {
    nextPlacements.set(accountId, new Date(now().getTime() + delayMs))
    schedule(accountId, delayMs)
  }

  async function stop(accountId) {
    await repository.deleteAgent(accountId)
    forget(accountId)
  }

  // Un passage de l'agent : au plus une pose.
  async function tick(accountId) {
    const agent = await repository.findAgent(accountId)
    if (!agent) return forget(accountId)

    // Le compte est relu à chaque passage : un joueur banni ou sans équipe ne pose plus.
    const account = await repository.findAccount(accountId)
    if (!account || account.bannedAt || account.teamId == null) return stop(accountId)

    const [target] = findMissingPixels(agent.pixels, await repository.findVisiblePixels(boundsOf(agent.pixels)))
    if (!target) {
      nextPlacements.delete(accountId)
      return schedule(accountId, idleCheckMs)
    }

    const lastPlacementAt = await repository.findLastPlacementAt(accountId)
    const waitMs = lastPlacementAt ? lastPlacementAt.getTime() + cooldownMs - now().getTime() : 0
    if (waitMs > 0) return scheduleNextPlacement(accountId, waitMs)

    try {
      // L'équipe est celle du compte au moment de la pose, comme pour une pose à la main.
      await canvasService.placePixel(target, { accountId: String(accountId), teamId: account.teamId })
      scheduleNextPlacement(accountId, cooldownMs)
    } catch (error) {
      if (error?.code === 'ACCOUNT_BANNED') return stop(accountId)
      if (error?.code === 'COOLDOWN_ACTIVE') return scheduleNextPlacement(accountId, COOLDOWN_RETRY_MS)
      throw error
    }
  }

  async function runTick(accountId) {
    timers.delete(accountId)
    try {
      await tick(accountId)
    } catch (error) {
      // Une erreur passagère (base occupée) ne doit pas arrêter l'agent : il réessaie plus tard.
      logger.error('Passage de l’agent de dessin impossible', { errorName: error?.name })
      schedule(accountId, idleCheckMs)
    }
  }

  // Ce que l'API montre d'un agent : sa progression et son modèle.
  async function describe(agent) {
    const missing = findMissingPixels(agent.pixels, await repository.findVisiblePixels(boundsOf(agent.pixels)))
    const nextPlacementAt = missing.length > 0 ? nextPlacements.get(agent.accountId) : null
    return {
      status: 'running',
      startedAt: agent.startedAt,
      total: agent.pixels.length,
      done: agent.pixels.length - missing.length,
      nextPlacementAt: nextPlacementAt ? nextPlacementAt.toISOString() : null,
      pixels: agent.pixels,
    }
  }

  return {
    // account : le compte de la session. agent vaut null quand aucun agent ne travaille.
    async getAgent(account) {
      const agent = await repository.findAgent(account.id)
      return { agent: agent ? await describe(agent) : null }
    },

    // body : le corps de la requête, { pixels }. Un seul modèle est actif par compte.
    async startAgent(body, account) {
      if (account.teamId == null) throw forbidden('Choisissez une équipe avant de lancer votre agent.', 'TEAM_REQUIRED')
      if (account.bannedAt) throw forbidden('Ce compte est banni : il ne peut plus lancer d’agent.', 'ACCOUNT_BANNED')
      const pixels = readModel(body)

      const agent = await repository.createAgent({ accountId: account.id, pixels, startedAt: now() })
      if (!agent) {
        throw conflict('Votre agent travaille déjà sur un modèle. Arrêtez-le avant d’en lancer un autre.', 'AGENT_ALREADY_ACTIVE')
      }
      schedule(account.id, 0)
      return { agent: await describe(agent) }
    },

    // Arrêter un agent déjà arrêté n'est pas une erreur.
    async stopAgent(account) {
      await stop(account.id)
    },

    // Relance les agents enregistrés : appelé au démarrage du serveur.
    async resume() {
      for (const accountId of await repository.listAgentAccountIds()) schedule(accountId, 0)
    },

    // Arrête les minuteurs sans toucher à la base : les agents reprendront au prochain démarrage.
    shutdown() {
      closed = true
      for (const accountId of [...timers.keys()]) forget(accountId)
    },
  }
}
