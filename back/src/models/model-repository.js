import { prisma } from '../canvas/canvas-repository.js'

async function countUsed(client, accountId, day) {
  const quota = await client.modelQuota.findUnique({ where: { accountId_day: { accountId, day } } })
  return quota?.used ?? 0
}

export function createModelRepository(client = prisma) {
  return {
    countUsed: (accountId, day) => countUsed(client, accountId, day),

    async reserve({ accountId, day, now, expiresAt, token, limit }) {
      return client.$transaction(async (transaction) => {
        // Cette première écriture prend le verrou SQLite avant de lire le quota et la réservation.
        await transaction.modelRequest.deleteMany({ where: { accountId, expiresAt: { lte: now } } })
        if (await transaction.modelRequest.findUnique({ where: { accountId } })) return 'busy'
        if (await countUsed(transaction, accountId, day) >= limit) return 'exhausted'
        await transaction.modelRequest.create({ data: { accountId, expiresAt, token } })
        // Une ligne par compte suffit après le changement de jour.
        await transaction.modelQuota.deleteMany({ where: { accountId, day: { lt: day } } })
        return 'reserved'
      })
    },

    async consume({ accountId, day, token, now }) {
      return client.$transaction(async (transaction) => {
        const { count } = await transaction.modelRequest.deleteMany({
          where: { accountId, token, expiresAt: { gt: now } },
        })
        if (count === 0) return false
        await transaction.modelQuota.upsert({
          where: { accountId_day: { accountId, day } },
          create: { accountId, day, used: 1 },
          update: { used: { increment: 1 } },
        })
        return true
      })
    },

    release: (accountId, token) => client.modelRequest.deleteMany({ where: { accountId, token } }),
  }
}

export const modelRepository = createModelRepository()
