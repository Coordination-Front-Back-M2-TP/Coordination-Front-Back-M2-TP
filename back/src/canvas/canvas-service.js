const MIN_COORDINATE = -50
const MAX_COORDINATE = 50
const COLOR_PATTERN = /^#[0-9a-f]{6}$/i

export function createCanvasService({ repository, publish = () => {} }) {
  return {
    getSnapshot() {
      return repository.getSnapshot()
    },

    async savePixel(pixel) {
      if (!pixel || typeof pixel !== 'object'
        || !Number.isSafeInteger(pixel.x) || pixel.x < MIN_COORDINATE || pixel.x > MAX_COORDINATE
        || !Number.isSafeInteger(pixel.y) || pixel.y < MIN_COORDINATE || pixel.y > MAX_COORDINATE
        || typeof pixel.color !== 'string' || !COLOR_PATTERN.test(pixel.color)) {
        throw new TypeError('Pixel invalide')
      }

      const savedPixel = await repository.savePixel(pixel)
      publish(savedPixel)
      return savedPixel
    },
  }
}
