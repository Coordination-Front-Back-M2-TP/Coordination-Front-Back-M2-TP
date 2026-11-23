import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import prismaClient from '@prisma/client'
import { forbidden, tooManyRequests } from '../errors/app-error.js'

process.env.DATABASE_URL ??= 'file:./prisma/dev.db'

const { PrismaClient } = prismaClient
export const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL }),
})

const BOARD_WIDTH = 101
const BOARD_HEIGHT = 101
// Un identifiant de compte de la base. Les sessions factices des tests en ont d'autres.
const ACCOUNT_ID_PATTERN = /^\d{1,15}$/

function toPixelRecord(pixel) {
  return {
    x: pixel.x,
    y: pixel.y,
    color: pixel.color,
    updatedAt: pixel.updatedAt.toISOString(),
    revision: pixel.revision,
  }
}

// now : horloge du serveur. Les tests la remplacent pour faire avancer le temps sans attendre.
export function createCanvasRepository(client = prisma, { now = () => new Date() } = {}) {
  return {
    async getSnapshot() {
      return client.$transaction(async (transaction) => {
        const state = await transaction.canvasState.findUniqueOrThrow({ where: { id: 1 } })
        const records = await transaction.pixel.findMany({ orderBy: [{ y: 'asc' }, { x: 'asc' }] })

        return {
          width: BOARD_WIDTH,
          height: BOARD_HEIGHT,
          revision: state.revision,
          snapshotAt: new Date().toISOString(),
          pixels: records.map(toPixelRecord),
        }
      })
    },

    // placement (facultatif) : { accountId, teamId } de la session.
    // L'historique et le pixel visible sont enregistrés dans la même transaction.
    // cooldownMs : délai entre deux poses d'un même compte. Une pose envoyée avant la fin du délai
    // est refusée en 429 et la transaction est annulée : ni toile, ni historique, ni révision ne changent.
    // Un compte banni est refusé en 403 ACCOUNT_BANNED, de la même façon.
    async savePixel({ x, y, color }, placement = null, { cooldownMs = 0 } = {}) {
      return client.$transaction(async (transaction) => {
        // L'écriture de la révision vient en premier : elle prend le verrou d'écriture de SQLite,
        // donc deux poses simultanées du même compte lisent l'historique l'une après l'autre.
        const state = await transaction.canvasState.update({
          where: { id: 1 },
          data: { revision: { increment: 1 } },
        })
        const updatedAt = now()
        let teamId = placement?.teamId
        // Le bannissement et l'équipe sont relus sous le verrou pour ordonner la pose
        // avec un changement d'équipe ou un bannissement intervenu depuis la lecture de la session.
        if (placement && ACCOUNT_ID_PATTERN.test(placement.accountId)) {
          const account = await transaction.account.findUnique({
            where: { id: Number(placement.accountId) },
            select: { bannedAt: true, teamId: true },
          })
          if (account?.bannedAt) throw forbidden('Ce compte est banni : il ne peut plus poser de pixel.', 'ACCOUNT_BANNED')
          if (account?.teamId === null) throw forbidden('Choisissez une équipe avant de poser un pixel.', 'TEAM_REQUIRED')
          teamId = account?.teamId ?? teamId
        }
        if (placement && cooldownMs > 0) {
          const lastPlacement = await transaction.pixelPlacement.findFirst({
            where: { accountId: placement.accountId },
            orderBy: { placedAt: 'desc' },
            select: { placedAt: true },
          })
          const remainingMs = lastPlacement
            ? lastPlacement.placedAt.getTime() + cooldownMs - updatedAt.getTime()
            : 0
          if (remainingMs > 0) {
            throw tooManyRequests(
              'Vous devez attendre la fin du délai avant de poser un autre pixel.',
              'COOLDOWN_ACTIVE',
              Math.ceil(remainingMs / 1000),
            )
          }
        }
        const pixel = await transaction.pixel.upsert({
          where: { x_y: { x, y } },
          create: { x, y, color, updatedAt, revision: state.revision },
          update: { color, updatedAt, revision: state.revision },
        })
        if (placement) {
          await transaction.pixelPlacement.create({
            data: {
              x,
              y,
              color,
              accountId: placement.accountId,
              teamId,
              placedAt: updatedAt,
              revision: state.revision,
            },
          })
        }

        return toPixelRecord(pixel)
      })
    },
  }
}

export const canvasRepository = createCanvasRepository()
