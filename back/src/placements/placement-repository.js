import { prisma } from '../canvas/canvas-repository.js'

// Seuls ces champs sortent de la base : le compte et l'équipe d'une pose restent privés.
const PUBLIC_FIELDS = { x: true, y: true, color: true, placedAt: true, revision: true }

function toPlacementRecord(placement) {
  return {
    x: placement.x,
    y: placement.y,
    color: placement.color,
    placedAt: placement.placedAt.toISOString(),
    revision: placement.revision,
  }
}

export function createPlacementRepository(client = prisma) {
  return {
    // from (inclus) et to (exclu) : dates ou null. after : révision de la dernière pose déjà lue, ou null.
    // L'ordre est celui des révisions, donc celui dans lequel les poses ont changé la toile.
    async findByPeriod({ from = null, to = null, after = null, limit }) {
      const where = {}
      if (from || to) where.placedAt = { ...(from && { gte: from }), ...(to && { lt: to }) }
      if (after !== null) where.revision = { gt: after }

      const records = await client.pixelPlacement.findMany({
        where,
        orderBy: { revision: 'asc' },
        take: limit,
        select: PUBLIC_FIELDS,
      })
      return records.map(toPlacementRecord)
    },
  }
}

export const placementRepository = createPlacementRepository()
