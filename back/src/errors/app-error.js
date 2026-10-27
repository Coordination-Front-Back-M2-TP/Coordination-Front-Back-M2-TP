// Erreur opérationnelle personnalisée pour l'application P1X3L.
// Permet de spécifier le code HTTP, le code d'erreur machine et le message utilisateur.
export class AppError extends Error {
  constructor(message, { statusCode = 500, code = 'INTERNAL_SERVER_ERROR', details = null, isOperational = true } = {}) {
    super(message)
    this.name = this.constructor.name
    this.statusCode = statusCode
    this.code = code
    this.details = details
    this.isOperational = isOperational
    Error.captureStackTrace?.(this, this.constructor)
  }
}

export function badRequest(message, code = 'BAD_REQUEST', details = null) {
  return new AppError(message, { statusCode: 400, code, details })
}

export function unauthorized(message = 'Authentification requise.', code = 'UNAUTHORIZED') {
  return new AppError(message, { statusCode: 401, code })
}

export function forbidden(message = 'Accès refusé.', code = 'FORBIDDEN') {
  return new AppError(message, { statusCode: 403, code })
}

export function notFound(message = 'Ressource introuvable.', code = 'NOT_FOUND') {
  return new AppError(message, { statusCode: 404, code })
}

export function conflict(message = 'La ressource est en conflit avec l’état actuel.', code = 'CONFLICT') {
  return new AppError(message, { statusCode: 409, code })
}

export function tooManyRequests(message = 'Délai actif, veuillez patienter.', code = 'COOLDOWN_ACTIVE') {
  return new AppError(message, { statusCode: 429, code })
}

export function internalError(message = 'Une erreur inattendue est survenue.', code = 'INTERNAL_SERVER_ERROR', details = null) {
  return new AppError(message, { statusCode: 500, code, details, isOperational: false })
}
