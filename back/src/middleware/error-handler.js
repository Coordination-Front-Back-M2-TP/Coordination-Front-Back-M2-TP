import { AppError, notFound } from '../errors/app-error.js'
import { logger } from '../utils/logger.js'

// Middleware pour les routes non trouvées (404).
export function notFoundHandler(req, res, next) {
  next(notFound(`Route introuvable : ${req.method} ${req.originalUrl}`))
}

// Convertit les erreurs de base de données (ex: Prisma, SQLite) en AppError standardisées.
function normalizeDatabaseError(err) {
  // Erreurs connues Prisma
  if (err.name === 'PrismaClientKnownRequestError') {
    if (err.code === 'P2002') {
      return new AppError('Cette ressource existe déjà.', {
        statusCode: 409,
        code: 'CONFLICT',
        details: err.meta,
      })
    }
    if (err.code === 'P2025') {
      return new AppError('Enregistrement introuvable.', {
        statusCode: 404,
        code: 'RECORD_NOT_FOUND',
        details: err.meta,
      })
    }
  }

  // Erreurs de contraintes SQLite directes
  if (typeof err.message === 'string' && err.message.includes('UNIQUE constraint failed')) {
    return new AppError('Cette ressource existe déjà.', {
      statusCode: 409,
      code: 'CONFLICT',
    })
  }

  return err
}

// Middleware centralisé de traitement des erreurs Express.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  let error = err

  // Erreur de syntaxe JSON dans le corps de la requête
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    error = new AppError('Corps de requête JSON invalide.', {
      statusCode: 400,
      code: 'INVALID_JSON',
    })
  } else {
    error = normalizeDatabaseError(error)
  }

  const statusCode = error.statusCode || error.status || 500
  const isOperational = error.isOperational ?? (statusCode < 500)
  const isProd = process.env.NODE_ENV === 'production'

  // Journalisation sécurisée sans données sensibles
  const logMeta = {
    method: req.method,
    url: req.originalUrl,
    statusCode,
    code: error.code || 'UNKNOWN_ERROR',
  }

  if (statusCode >= 500 || !isOperational) {
    logger.error(error.message, { ...logMeta, stack: error.stack })
  } else {
    logger.warn(error.message, logMeta)
  }

  // En production, ne jamais exposer les détails internes, stacks ou messages d'erreurs 500
  const isServerError = statusCode >= 500
  const responseBody = {
    error: {
      code: isServerError && isProd ? 'INTERNAL_SERVER_ERROR' : (error.code || 'INTERNAL_SERVER_ERROR'),
      message: isServerError && isProd ? 'Une erreur inattendue est survenue.' : (error.message || 'Une erreur inattendue est survenue.'),
    },
  }

  // En développement, ajouter les détails de diagnostic
  if (!isProd) {
    if (error.details) {
      responseBody.error.details = error.details
    }
    if (error.stack) {
      responseBody.error.stack = error.stack
    }
  }

  res.status(statusCode).json(responseBody)
}
