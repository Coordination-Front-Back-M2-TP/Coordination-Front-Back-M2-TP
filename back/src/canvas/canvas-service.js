import { badRequest } from '../errors/app-error.js'

const MIN_COORDINATE = -50
const MAX_COORDINATE = 50
const COLOR_PATTERN = /^#[0-9a-f]{6}$/i

function isCoordinate(value) {
  return Number.isSafeInteger(value) && value >= MIN_COORDINATE && value <= MAX_COORDINATE
}

export function createCanvasService({ repository, publish = () => {} }) {
  return {
    getSnapshot() {
      return repository.getSnapshot()
    },

    // placement : { accountId, teamId } issus de la session, pour l'historique.
    async savePixel(pixel, placement = null) {
      if (!pixel || typeof pixel !== 'object'
        || !isCoordinate(pixel.x) || !isCoordinate(pixel.y)
        || typeof pixel.color !== 'string' || !COLOR_PATTERN.test(pixel.color)) {
        throw badRequest('Cette case ou cette couleur n’est pas acceptée.', 'INVALID_INPUT')
      }

      // Seuls x, y et color sont gardés : un champ en trop dans le corps n'atteint pas la base.
      const savedPixel = await repository.savePixel(
        { x: pixel.x, y: pixel.y, color: pixel.color.toUpperCase() },
        placement,
      )
      publish(savedPixel)
      return savedPixel
    },
  }
}
