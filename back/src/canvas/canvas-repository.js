import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import prismaClient from '@prisma/client'

process.env.DATABASE_URL ??= 'file:./prisma/dev.db'

const { PrismaClient } = prismaClient
export const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL }),
})

const BOARD_WIDTH = 101
const BOARD_HEIGHT = 101

function toPixelRecord(pixel) {
  return {
    x: pixel.x,
    y: pixel.y,
    color: pixel.color,
    updatedAt: pixel.updatedAt.toISOString(),
    revision: pixel.revision,
  }
}

export function createCanvasRepository(client = prisma) {
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

    async savePixel({ x, y, color }) {
      return client.$transaction(async (transaction) => {
        const state = await transaction.canvasState.update({
          where: { id: 1 },
          data: { revision: { increment: 1 } },
        })
        const updatedAt = new Date()
        const pixel = await transaction.pixel.upsert({
          where: { x_y: { x, y } },
          create: { x, y, color, updatedAt, revision: state.revision },
          update: { color, updatedAt, revision: state.revision },
        })

        return toPixelRecord(pixel)
      })
    },

    // Pose d'un pixel par un joueur : le contrat exige que l'historique, la toile
    // et la révision soient écrits dans la même transaction.
    async placePixel({ x, y, color, accountId, teamId }) {
      return client.$transaction(async (transaction) => {
        const state = await transaction.canvasState.update({
          where: { id: 1 },
          data: { revision: { increment: 1 } },
        })
        const placedAt = new Date()
        const pixel = await transaction.pixel.upsert({
          where: { x_y: { x, y } },
          create: { x, y, color, updatedAt: placedAt, revision: state.revision },
          update: { color, updatedAt: placedAt, revision: state.revision },
        })
        await transaction.pixelPlacement.create({
          data: { accountId, teamId, x, y, color, placedAt, revision: state.revision },
        })

        return toPixelRecord(pixel)
      })
    },
  }
}

export const canvasRepository = createCanvasRepository()
