async function request(path, options) {
  const response = await fetch('/api/moderation/' + path, { credentials: 'same-origin', ...options })
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw Object.assign(new Error('Requête de modération refusée'), { code: payload?.error?.code })
  }
  return payload
}

function readPlayer({ pseudo, role, banned } = {}) {
  if (typeof pseudo !== 'string' || !pseudo || !['admin', 'player'].includes(role) || typeof banned !== 'boolean') {
    throw new Error('Joueur invalide')
  }
  return { pseudo, role, banned }
}

export async function listModerationPlayers(after, signal) {
  const query = after ? '?' + new URLSearchParams({ after }) : ''
  const { players, nextCursor } = await request('players' + query, { signal }) ?? {}
  if (!Array.isArray(players) || (nextCursor !== null && (typeof nextCursor !== 'string' || !nextCursor))) {
    throw new Error('Page de joueurs invalide')
  }
  return { players: players.map(readPlayer), nextCursor }
}

export async function banPlayer(pseudo, signal) {
  const { action } = await request('bans', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pseudo }),
    signal,
  }) ?? {}
  const { restoredCount, clearedCount } = action?.details ?? {}
  if (action?.type !== 'player_ban' || !Number.isSafeInteger(action.id) || action.id < 1
    || ![restoredCount, clearedCount].every((count) => Number.isSafeInteger(count) && count >= 0)) {
    throw new Error('Action de bannissement invalide')
  }
  return { pseudo, id: action.id, restoredCount, clearedCount }
}
