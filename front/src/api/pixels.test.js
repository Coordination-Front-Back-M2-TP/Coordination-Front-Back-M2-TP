import { afterEach, expect, it, vi } from 'vitest'
import { PlacePixelError, placePixel } from './pixels.js'

const pixel = { x: 12, y: 8, color: '#D93A3A', updatedAt: '2026-10-27T14:30:00.000Z', revision: 185 }
const reply = (status, body, headers = {}) => new Response(JSON.stringify(body), { status, headers })

afterEach(() => vi.unstubAllGlobals())

it('envoie seulement les coordonnées et la couleur, avec le cookie de session', async () => {
  const fetch = vi.fn().mockResolvedValue(reply(200, { pixel, cooldownEndsAt: '2026-10-27T14:30:10.000Z' }))
  vi.stubGlobal('fetch', fetch)
  const result = await placePixel({ x: 12, y: 8, color: '#D93A3A' })
  expect(result).toEqual({ pixel, cooldownEndsAt: '2026-10-27T14:30:10.000Z' })
  const [path, options] = fetch.mock.calls[0]
  expect(path).toBe('/api/pixels')
  expect(options.method).toBe('POST')
  expect(options.credentials).toBe('same-origin')
  // L'historique tient le compte et l'équipe de la session serveur : le client ne les envoie jamais.
  expect(JSON.parse(options.body)).toEqual({ x: 12, y: 8, color: '#D93A3A' })
})

it('remonte le code d’erreur du contrat, et le délai restant d’un 429', async () => {
  vi.stubGlobal('fetch', vi.fn()
    .mockResolvedValueOnce(reply(401, { error: { code: 'UNAUTHORIZED', message: 'x' } }))
    .mockResolvedValueOnce(reply(429, { error: { code: 'COOLDOWN_ACTIVE', message: 'x' } }, { 'Retry-After': '7' })))
  await expect(placePixel({ x: 0, y: 0, color: '#000000' })).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  await expect(placePixel({ x: 0, y: 0, color: '#000000' })).rejects.toMatchObject({ code: 'COOLDOWN_ACTIVE', retryAfterSeconds: 7 })
})

it('refuse une réponse incompatible et signale une coupure réseau', async () => {
  vi.stubGlobal('fetch', vi.fn()
    .mockResolvedValueOnce(reply(200, { pixel: { ...pixel, color: 'rouge' }, cooldownEndsAt: '2026-10-27T14:30:10.000Z' }))
    .mockRejectedValueOnce(new TypeError('Failed to fetch')))
  await expect(placePixel({ x: 0, y: 0, color: '#000000' })).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  const error = await placePixel({ x: 0, y: 0, color: '#000000' }).catch((caught) => caught)
  expect(error).toBeInstanceOf(PlacePixelError)
  expect(error.code).toBe('NETWORK_ERROR')
})
