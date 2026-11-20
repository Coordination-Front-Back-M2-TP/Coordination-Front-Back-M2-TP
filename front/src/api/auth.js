// Le navigateur gère le cookie de session sur la même origine que l'API.
export class AuthError extends Error {
  constructor(code) {
    super(code)
    this.code = code
  }
}

async function request(path, { method, body, signal } = {}) {
  const response = await fetch('/api/auth/' + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
    signal,
  })

  if (path === 'me' && response.status === 401) return null
  if (response.ok && path === 'logout') return

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const code = typeof payload?.error?.code === 'string' ? payload.error.code : 'UNKNOWN'
    throw new AuthError(code)
  }
  if (typeof payload?.user?.pseudo !== 'string') throw new AuthError('INVALID_RESPONSE')
  return payload.user
}

export function getCurrentUser(signal) {
  return request('me', { signal })
}

export function register(pseudo, password) {
  return request('register', { method: 'POST', body: { pseudo, password } })
}

export function login(pseudo, password) {
  return request('login', { method: 'POST', body: { pseudo, password } })
}

export function logout() {
  return request('logout', { method: 'POST' })
}
