import { PALETTE } from './palette.js'

export const MODERATION_LABELS = Object.freeze({ jev: 'Jev', openai: 'OpenAI' })
export const MAX_PROMPT_LENGTH = 500
const MAX_MODEL_SIZE = 32
const PALETTE_COLORS = new Set(PALETTE.map(({ color }) => color))

function parseQuota(quota) {
  if (!Number.isSafeInteger(quota?.limit) || quota.limit < 1
    || !Number.isSafeInteger(quota.remaining) || quota.remaining < 0 || quota.remaining > quota.limit
    || typeof quota.resetsAt !== 'string' || !Number.isFinite(Date.parse(quota.resetsAt))) {
    throw new Error('Quota de modèles invalide')
  }
  return { limit: quota.limit, remaining: quota.remaining, resetsAt: quota.resetsAt }
}

function readQuota(quota, response) {
  const parsed = parseQuota(quota)
  const serverTime = Date.parse(response.headers.get('Date'))
  const now = Date.now()
  const clock = Number.isFinite(serverTime) ? serverTime : now
  return { quota: parsed, refreshAt: now + Date.parse(parsed.resetsAt) - clock }
}

function parseModel(model) {
  const { width, height, pixels } = model ?? {}
  if (!Number.isInteger(width) || width < 1 || width > MAX_MODEL_SIZE
    || !Number.isInteger(height) || height < 1 || height > MAX_MODEL_SIZE
    || !Array.isArray(pixels) || pixels.length === 0 || pixels.length > width * height) {
    throw new Error('Modèle invalide')
  }

  const cells = new Set()
  const placedPixels = pixels.map((pixel) => {
    const { x, y, color } = pixel ?? {}
    if (!Number.isInteger(x) || x < 0 || x >= width || !Number.isInteger(y) || y < 0 || y >= height
      || !PALETTE_COLORS.has(color)) {
      throw new Error('Pixel du modèle invalide')
    }
    const key = y * width + x
    if (cells.has(key)) throw new Error('Pixel du modèle en double')
    cells.add(key)
    return { x, y, color }
  })
  return { width, height, pixels: placedPixels }
}

async function readResponse(response) {
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw Object.assign(new Error('Requête de modèle refusée'), { code: payload?.error?.code })
  }
  return payload ?? {}
}

export async function getModelQuota(signal) {
  const response = await fetch('/api/models/quota', { credentials: 'same-origin', signal })
  const { quota, moderationProviders } = await readResponse(response)
  if (!Array.isArray(moderationProviders)
    || !moderationProviders.every((provider) => typeof provider === 'string' && Object.hasOwn(MODERATION_LABELS, provider))) {
    throw new Error('Services de modération invalides')
  }
  return { ...readQuota(quota, response), moderationProviders: [...new Set(moderationProviders)] }
}

export async function generateModel(prompt, moderationProvider, signal) {
  const response = await fetch('/api/models', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ prompt, moderationProvider }),
    signal,
  })
  const { model, quota } = await readResponse(response)
  return { model: parseModel(model), ...readQuota(quota, response) }
}
