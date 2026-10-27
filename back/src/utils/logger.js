// Logger sécurisé pour le backend P1X3L.
// Filtre les données sensibles (tokens, mots de passe, clés secrètes, cookies) avant journalisation.

const SENSITIVE_KEYS = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'password',
  'motdepasse',
  'token',
  'secret',
  'key',
  'apikey',
  'jwt',
])

function isSensitiveKey(key) {
  const normalizedKey = key.toLowerCase().replace(/[_-]/g, '')
  return SENSITIVE_KEYS.has(normalizedKey)
    || /(?:password|token|secret|apikey|privatekey)$/.test(normalizedKey)
}

export function sanitize(data) {
  if (data === null || data === undefined) return data
  if (typeof data !== 'object') return data

  if (Array.isArray(data)) {
    return data.map((item) => sanitize(item))
  }

  const clean = {}
  for (const [key, value] of Object.entries(data)) {
    if (isSensitiveKey(key)) {
      clean[key] = '[MASQUÉ]'
    } else if (typeof value === 'object' && value !== null) {
      clean[key] = sanitize(value)
    } else {
      clean[key] = value
    }
  }
  return clean
}

export function formatLog(level, message, meta = {}) {
  const timestamp = new Date().toISOString()
  const cleanMeta = sanitize(meta)
  const metaString = Object.keys(cleanMeta).length > 0 ? ` ${JSON.stringify(cleanMeta)}` : ''
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaString}`
}

export const logger = {
  // Par défaut, redirige vers console, mais peut être surchargé pour les tests.
  info(message, meta) {
    console.info(formatLog('info', message, meta))
  },
  warn(message, meta) {
    console.warn(formatLog('warn', message, meta))
  },
  error(message, meta) {
    console.error(formatLog('error', message, meta))
  },
}
