const MAX_PIXELS = 1024
const MAX_FILE_BYTES = 1_000_000

class DrawingAgentError extends Error {
  constructor(code) {
    super('Action de l’agent indisponible')
    this.code = code
  }
}

export async function readPlacedModel(file) {
  try {
    if (!file || file.size > MAX_FILE_BYTES) throw new Error()
    const { pixels } = JSON.parse(await file.text())
    if (!Array.isArray(pixels) || pixels.length === 0 || pixels.length > MAX_PIXELS) throw new Error()
    return pixels.map(({ x, y, color }) => {
      if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y)
        || typeof color !== 'string' || !/^#[0-9a-f]{6}$/i.test(color)) throw new Error()
      return { x, y, color }
    })
  } catch {
    throw new DrawingAgentError('INVALID_MODEL_FILE')
  }
}

async function request(method, signal, pixels) {
  const response = await fetch('/api/agent', {
    method,
    signal,
    credentials: 'same-origin',
    headers: pixels ? { 'Content-Type': 'application/json' } : undefined,
    body: pixels ? JSON.stringify({ pixels }) : undefined,
  })
  if (method === 'DELETE' && response.status === 204) return null

  const payload = await response.json().catch(() => null)
  if (!response.ok) throw new DrawingAgentError(payload?.error?.code)
  const agent = payload?.agent
  if (method === 'GET' && agent === null) return null
  if (method === 'DELETE' || agent?.status !== 'running'
    || !Number.isSafeInteger(agent.total) || agent.total < 1 || agent.total > MAX_PIXELS
    || !Number.isSafeInteger(agent.done) || agent.done < 0 || agent.done > agent.total) {
    throw new DrawingAgentError('INVALID_RESPONSE')
  }
  return { total: agent.total, done: agent.done }
}

export const getDrawingAgent = (signal) => request('GET', signal)
export const startDrawingAgent = (pixels, signal) => request('POST', signal, pixels)
export const stopDrawingAgent = (signal) => request('DELETE', signal)
