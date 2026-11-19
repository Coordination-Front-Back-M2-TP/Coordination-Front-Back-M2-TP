import { logger as defaultLogger } from './utils/logger.js'

// Laisse 9 s aux requêtes en cours avant de couper : Docker attend 10 s par défaut entre SIGTERM et SIGKILL.
const SHUTDOWN_TIMEOUT_MS = 9_000

// Branche le back sur les signaux du processus :
// - SIGTERM (docker stop, mise à jour) et SIGINT (Ctrl+C) : arrêt propre, code de sortie 0 ;
// - plantage hors d'une route (uncaughtException, unhandledRejection) : journalisé, puis arrêt, code 1.
//   Après un plantage, l'état du processus n'est plus sûr : on le relance plutôt que de continuer.
//   C'est Docker qui le redémarre (restart: unless-stopped dans deploy/compose.yml).
// Les erreurs dans les routes ne passent pas ici : le middleware error-handler.js les traite.
export function installProcessHandlers({
  httpServer,
  io,
  disconnect = async () => {},
  proc = process,
  exit = (code) => proc.exit(code),
  logger = defaultLogger,
  timeoutMs = SHUTDOWN_TIMEOUT_MS,
}) {
  let shuttingDown = false

  async function shutdown(reason, exitCode) {
    if (shuttingDown) return
    shuttingDown = true
    logger.info('Arrêt du back', { reason })

    // Filet de sécurité : si une connexion ne se ferme pas, on sort quand même.
    const timer = setTimeout(() => {
      logger.error('Arrêt forcé : des connexions restaient ouvertes', { reason, timeoutMs })
      exit(exitCode || 1)
    }, timeoutMs)
    timer.unref?.()

    try {
      // io.close() ferme les sockets puis le serveur HTTP, qui finit les requêtes déjà reçues.
      await new Promise((resolve) => (io ? io.close(() => resolve()) : httpServer.close(() => resolve())))
      await disconnect()
    } catch (error) {
      logger.error('Erreur pendant l’arrêt', { errorName: error?.name, message: error?.message })
      exitCode = exitCode || 1
    }
    clearTimeout(timer)
    exit(exitCode)
  }

  function onCrash(kind) {
    return (error) => {
      logger.error('Plantage du processus', {
        kind,
        errorName: error?.name,
        message: error?.message,
        stack: error?.stack?.split('\n').slice(1).join('\n'),
      })
      shutdown(kind, 1)
    }
  }

  proc.on('SIGTERM', () => shutdown('SIGTERM', 0))
  proc.on('SIGINT', () => shutdown('SIGINT', 0))
  proc.on('uncaughtException', onCrash('uncaughtException'))
  proc.on('unhandledRejection', onCrash('unhandledRejection'))

  return { shutdown }
}
