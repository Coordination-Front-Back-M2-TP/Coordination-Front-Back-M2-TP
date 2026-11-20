export class TeamCreationError extends Error {
  constructor(code, retryAfterMs = 0) {
    super(code)
    this.code = code
    this.retryAfterMs = retryAfterMs
  }
}

export async function createTeam(name, color) {
  const response = await fetch('/api/teams', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ name, color }),
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const code = payload?.error?.code
    const retryAfter = response.status === 429 ? Number(response.headers.get('Retry-After')) : 0
    const retryAfterMs = Number.isSafeInteger(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 0
    throw new TeamCreationError(code, retryAfterMs)
  }

  const team = payload?.user?.team
  const availableAt = Date.parse(payload?.teamChangeAvailableAt)
  if (typeof team?.id !== 'string' || typeof team.name !== 'string'
    || typeof team.color !== 'string' || !Number.isFinite(availableAt)) {
    throw new TeamCreationError('INVALID_RESPONSE')
  }

  return { team, availableAt }
}
