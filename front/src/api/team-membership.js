function isTeam(team) {
  return typeof team?.id === 'string' && typeof team.name === 'string'
}

export async function listTeams(signal) {
  const response = await fetch('/api/teams', { signal })
  if (!response.ok) throw new Error('Liste des équipes indisponible')
  const { teams } = await response.json()
  if (!Array.isArray(teams) || !teams.every(isTeam)) throw new Error('Liste des équipes invalide')
  return teams
}

export async function joinTeam(teamId, signal) {
  const response = await fetch('/api/auth/me/team', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ teamId }),
    signal,
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const retryAfter = response.status === 429 ? Number(response.headers.get('Retry-After')) : 0
    const retryAfterMs = Number.isSafeInteger(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 0
    throw Object.assign(new Error('Choix d’équipe refusé'), { code: payload?.error?.code, retryAfterMs })
  }
  const user = payload?.user
  if (typeof user?.pseudo !== 'string' || !isTeam(user.team) || user.team.id !== teamId) {
    throw new Error('Équipe du joueur invalide')
  }
  return user
}

export async function createTeam(name, color, signal) {
  const response = await fetch('/api/teams', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ name, color }),
    signal,
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const retryAfter = response.status === 429 ? Number(response.headers.get('Retry-After')) : 0
    const retryAfterMs = Number.isSafeInteger(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 0
    throw Object.assign(new Error('Création d’équipe refusée'), { code: payload?.error?.code, retryAfterMs })
  }
  const { team, user } = payload ?? {}
  if (!isTeam(team) || typeof team.color !== 'string' || typeof user?.pseudo !== 'string'
    || !isTeam(user.team) || user.team.id !== team.id) throw new Error('Équipe créée invalide')
  return { team, user }
}
