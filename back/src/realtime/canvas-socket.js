import { Server } from 'socket.io'
import { logger } from '../utils/logger.js'

// Room Socket.IO regroupant les abonnés aux changements de la toile.
const CANVAS_ROOM = 'canvas'

// Le payload de canvas:error reste limité à code et message, même en développement :
// le contrat n'y autorise ni stack ni détails de diagnostic.
const BOARD_UNAVAILABLE = {
  error: {
    code: 'BOARD_UNAVAILABLE',
    message: 'La toile est momentanément indisponible.',
  },
}

// Branche le temps réel sur le serveur HTTP de l'application (même port que l'API,
// namespace « / », sans authentification : la lecture de la toile est publique).
export function attachCanvasSocket(httpServer, store) {
  const io = new Server(httpServer)

  // Le store n'émet qu'après persistance : un pixel:updated n'annonce jamais une écriture
  // qui a échoué, et l'état lu par un nouvel abonné inclut déjà le pixel diffusé.
  store.events.on('pixel:updated', (pixel) => {
    io.to(CANVAS_ROOM).emit('pixel:updated', pixel)
  })

  io.on('connection', (socket) => {
    socket.on('canvas:subscribe', (acknowledge) => {
      try {
        // L'abonnement est enregistré AVANT la lecture de l'instantané : un changement posé
        // entre les deux est diffusé par pixel:updated avec une révision supérieure à celle
        // de l'instantané, et le client l'applique après l'ACK (docs/contrat-api.md).
        socket.join(CANVAS_ROOM)
        const snapshot = store.getSnapshot()
        if (typeof acknowledge === 'function') {
          acknowledge(snapshot)
        }
      } catch (error) {
        socket.leave(CANVAS_ROOM)
        logger.error('Erreur lors de l’abonnement à la toile', {
          code: error.code || 'UNKNOWN_ERROR',
          errorName: error.name,
          stack: error.stack?.split('\n').slice(1).join('\n'),
        })
        socket.emit('canvas:error', BOARD_UNAVAILABLE)
      }
    })

    socket.on('canvas:unsubscribe', () => {
      socket.leave(CANVAS_ROOM)
    })

    // Rien à faire sur « disconnect » : Socket.IO retire le socket de ses rooms tout seul.
  })

  return io
}
