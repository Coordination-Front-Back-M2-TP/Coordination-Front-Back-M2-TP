import { badRequest } from '../errors/app-error.js'

const MIN_COORDINATE = -50
const MAX_COORDINATE = 50
const COLOR_PATTERN = /^#[0-9a-f]{6}$/i
// Durée proposée par le contrat pour la démo ; sa valeur définitive reste à confirmer par l'équipe.
const DEFAULT_COOLDOWN_SECONDS = 10

function isCoordinate(value) {
  return Number.isSafeInteger(value) && value >= MIN_COORDINATE && value <= MAX_COORDINATE
}

// Lit le délai entre deux poses dans PIXEL_COOLDOWN_SECONDS. Une valeur absente, vide,
// négative ou illisible donne le délai par défaut ; 0 désactive le délai.
export function readCooldownMs(env = process.env) {
  const raw = env.PIXEL_COOLDOWN_SECONDS
  const seconds = raw === undefined || String(raw).trim() === '' ? Number.NaN : Number(raw)
  return Math.round((Number.isFinite(seconds) && seconds >= 0 ? seconds : DEFAULT_COOLDOWN_SECONDS) * 1000)
}

export function createCanvasService({ repository, publish = () => {}, cooldownMs = readCooldownMs() }) {
  // placement : compte et équipe de la session, avec source: 'manual' pour la route POST /api/pixels.
  async function savePixel(pixel, placement = null) {
    if (!pixel || typeof pixel !== 'object'
      || !isCoordinate(pixel.x) || !isCoordinate(pixel.y)
      || typeof pixel.color !== 'string' || !COLOR_PATTERN.test(pixel.color)) {
      throw badRequest('Cette case ou cette couleur n’est pas acceptée.', 'INVALID_INPUT')
    }

    // Seuls x, y et color sont gardés : un champ en trop dans le corps n'atteint pas la base.
    const savedPixel = await repository.savePixel(
      { x: pixel.x, y: pixel.y, color: pixel.color.toUpperCase() },
      placement,
      { cooldownMs },
    )
    publish(savedPixel)
    return savedPixel
  }

  return {
    getSnapshot() {
      return repository.getSnapshot()
    },

    savePixel,

    // Pose d'un joueur : le pixel enregistré et l'heure serveur à laquelle son compte pourra reposer.
    async placePixel(pixel, player) {
      const savedPixel = await savePixel(pixel, player)
      const cooldownEndsAt = new Date(Date.parse(savedPixel.updatedAt) + cooldownMs).toISOString()
      return { pixel: savedPixel, cooldownEndsAt }
    },
  }
}
