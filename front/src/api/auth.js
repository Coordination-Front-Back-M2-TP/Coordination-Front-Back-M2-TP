// Appels d'authentification. Routes SUPPOSÉES : le contrat de l'EPIC #17 (tâche #37) n'est pas encore mergé.
// Tout ce qui dépend de ce contrat (chemins, corps, codes) est concentré ici, pour l'ajuster en un seul endroit.
// La session est portée par un cookie géré par le serveur : le front ne stocke aucun jeton.

export class AuthError extends Error {
  constructor(code) {
    super(code)
    this.code = code
  }
}

async function post(path, body, signal) {
  const response = await fetch(path, {
    method: 'POST',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal,
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new AuthError(payload?.error?.code ?? 'UNKNOWN')
  }
  return response.status === 204 ? null : response.json().catch(() => null)
}

function readUser(body) {
  const pseudo = body?.user?.pseudo
  if (typeof pseudo !== 'string') throw new AuthError('INVALID_RESPONSE')
  return { pseudo }
}

// Renvoie le joueur connecté, ou null s'il n'y a pas de session (401).
export async function getCurrentUser(signal) {
  const response = await fetch('/api/auth/me', { signal })
  if (response.status === 401) return null
  if (!response.ok) throw new AuthError('UNKNOWN')
  const body = await response.json().catch(() => null)
  return body?.user ? readUser(body) : null
}

export async function register(pseudo, password, signal) {
  return readUser(await post('/api/auth/register', { pseudo, password }, signal))
}

export async function login(pseudo, password, signal) {
  return readUser(await post('/api/auth/login', { pseudo, password }, signal))
}

export async function logout(signal) {
  await post('/api/auth/logout', null, signal)
}
