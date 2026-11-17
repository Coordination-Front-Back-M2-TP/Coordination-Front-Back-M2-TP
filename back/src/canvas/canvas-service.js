const MIN_COORDINATE = -50
const MAX_COORDINATE = 50
const COLOR_PATTERN = /^#[0-9a-f]{6}$/i

// Durée de démonstration du délai entre deux poses, réglable côté serveur.
// Le rejet pendant le délai (429 COOLDOWN_ACTIVE) est l'issue #46 : la valeur
// est calculée et renvoyée au client, mais pas encore contraignante.
export const PIXEL_COOLDOWN_MS = 10_000

function assertValidPixel(pixel) {
  if (!pixel || typeof pixel !== 'object'
    || !Number.isSafeInteger(pixel.x) || pixel.x < MIN_COORDINATE || pixel.x > MAX_COORDINATE
    || !Number.isSafeInteger(pixel.y) || pixel.y < MIN_COORDINATE || pixel.y > MAX_COORDINATE
    || typeof pixel.color !== 'string' || !COLOR_PATTERN.test(pixel.color)) {
    throw new TypeError('Pixel invalide')
  }
}

export function createCanvasService({ repository, publish = () => {}, cooldownMs = PIXEL_COOLDOWN_MS }) {
  return {
    getSnapshot() {
      return repository.getSnapshot()
    },

    async savePixel(pixel) {
      assertValidPixel(pixel)

      const savedPixel = await repository.savePixel(pixel)
      publish(savedPixel)
      return savedPixel
    },

    // Pose d'un pixel par un joueur identifié : validation, enregistrement
    // atomique (toile + historique + révision), puis diffusion après persistance.
    async placePixel({ x, y, color, accountId, teamId }) {
      assertValidPixel({ x, y, color })

      const savedPixel = await repository.placePixel({ x, y, color, accountId, teamId })
      publish(savedPixel)
      return {
        pixel: savedPixel,
        cooldownEndsAt: new Date(Date.parse(savedPixel.updatedAt) + cooldownMs).toISOString(),
      }
    },
  }
}
