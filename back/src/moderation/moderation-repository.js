import { prisma } from '../canvas/canvas-repository.js'

export const ZONE_CLEANUP = 'zone_cleanup'

// Une ligne du journal telle que le service la lit : details redevient un objet.
function toActionRecord(action) {
  return {
    id: action.id,
    type: action.type,
    adminPseudo: action.adminPseudo,
    createdAt: action.createdAt.toISOString(),
    details: JSON.parse(action.details),
  }
}

// now : horloge du serveur. Les tests la remplacent pour dater les actions.
export function createModerationRepository(client = prisma, { now = () => new Date() } = {}) {
  return {
    // Supprime les pixels visibles de la zone et note l'action dans le journal, dans une seule
    // transaction : un nettoyage sans ligne de journal, ou l'inverse, ne peut pas exister.
    // L'historique des poses n'est pas touché.
    async cleanZone({ fromX, fromY, toX, toY }, admin) {
      return client.$transaction(async (transaction) => {
        // L'écriture de la révision vient en premier, comme pour la pose : elle prend le verrou
        // d'écriture de SQLite, donc une pose simultanée passe entièrement avant ou après le nettoyage.
        const state = await transaction.canvasState.update({
          where: { id: 1 },
          data: { revision: { increment: 1 } },
        })
        const { count } = await transaction.pixel.deleteMany({
          where: { x: { gte: fromX, lte: toX }, y: { gte: fromY, lte: toY } },
        })
        const action = await transaction.moderationAction.create({
          data: {
            type: ZONE_CLEANUP,
            adminAccountId: admin.id,
            adminPseudo: admin.pseudo,
            createdAt: now(),
            details: JSON.stringify({ fromX, fromY, toX, toY, removedCount: count, revision: state.revision }),
          },
        })
        return toActionRecord(action)
      })
    },

    // Les actions les plus récentes d'abord. before : identifiant de la dernière action déjà lue, ou null.
    async listActions({ before = null, limit }) {
      const actions = await client.moderationAction.findMany({
        where: before === null ? {} : { id: { lt: before } },
        orderBy: { id: 'desc' },
        take: limit,
      })
      return actions.map(toActionRecord)
    },
  }
}

export const moderationRepository = createModerationRepository()
