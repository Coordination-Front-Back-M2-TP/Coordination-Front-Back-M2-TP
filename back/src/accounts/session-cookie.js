export const SESSION_COOKIE = 'p1x3l_session'
// Un jeton de session : 32 octets en base64url, soit 43 caractères.
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/

// HttpOnly : le JavaScript de la page ne lit pas le cookie. SameSite=Lax : un autre site ne peut pas
// faire envoyer le cookie avec un POST. Secure en production, où tout passe en HTTPS.
function cookieOptions() {
  return { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/' }
}

// Lit le jeton de session dans l'en-tête Cookie. Une valeur qui n'a pas la forme d'un jeton est ignorée.
export function readSessionToken(req) {
  const header = req.headers?.cookie
  if (typeof header !== 'string') return null
  for (const part of header.split(';')) {
    const separator = part.indexOf('=')
    if (separator === -1 || part.slice(0, separator).trim() !== SESSION_COOKIE) continue
    const value = part.slice(separator + 1).trim()
    return TOKEN_PATTERN.test(value) ? value : null
  }
  return null
}

export function setSessionCookie(res, { token, expiresAt }) {
  res.cookie(SESSION_COOKIE, token, { ...cookieOptions(), expires: expiresAt })
}

export function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE, cookieOptions())
}
