import { parsePixel } from './canvas-state.js'

// Pose d'un pixel, selon le contrat de l'EPIC #42 (docs/contrat-api.md, « POST /api/pixels »).
// Le transport de la session n'est pas encore fixé par le contrat #18 : on suppose un cookie géré par le serveur,
// donc le front n'envoie ni jeton, ni identifiant de compte, ni identifiant d'équipe. Le serveur les déduit de la session.
export class PlacePixelError extends Error {
  constructor(code, { retryAfterSeconds } = {}) {
    super(code)
    this.code = code
    this.retryAfterSeconds = retryAfterSeconds
  }
}

function readRetryAfter(response) {
  const seconds = Number.parseInt(response.headers.get('Retry-After') ?? '', 10)
  return Number.isSafeInteger(seconds) && seconds >= 0 ? seconds : undefined
}

export async function placePixel({ x, y, color }, signal) {
  let response
  try {
    response = await fetch('/api/pixels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ x, y, color }),
      signal,
    })
  } catch (error) {
    if (error?.name === 'AbortError') throw error
    throw new PlacePixelError('NETWORK_ERROR')
  }

  const body = await response.json().catch(() => null)
  if (!response.ok) {
    const code = typeof body?.error?.code === 'string' ? body.error.code : 'UNKNOWN'
    throw new PlacePixelError(code, { retryAfterSeconds: response.status === 429 ? readRetryAfter(response) : undefined })
  }

  const cooldownEndsAt = body?.cooldownEndsAt
  if (typeof cooldownEndsAt !== 'string' || Number.isNaN(Date.parse(cooldownEndsAt))) {
    throw new PlacePixelError('INVALID_RESPONSE')
  }
  try {
    return { pixel: parsePixel(body.pixel), cooldownEndsAt }
  } catch {
    throw new PlacePixelError('INVALID_RESPONSE')
  }
}
