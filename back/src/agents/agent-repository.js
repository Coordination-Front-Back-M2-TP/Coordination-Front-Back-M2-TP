import { isInsideCanvas } from '../canvas/canvas-bounds.js'
import { prisma } from '../canvas/canvas-repository.js'
import { badRequest } from '../errors/app-error.js'

// Un agent tel que le service le lit : pixels redevient un tableau.
function toAgentRecord(agent) {
  return {
    accountId: agent.accountId,
    pixels: JSON.parse(agent.pixels),
    startedAt: agent.startedAt.toISOString(),
  }
}

export function createAgentRepository(client = prisma) {
  return {
    // Renvoie l'agent créé, ou null si le compte en a déjà un. L'unicité est tenue par la base :
    // deux lancements simultanés du même compte ne peuvent pas passer tous les deux.
    async createAgent({ accountId, pixels, startedAt }) {
      try {
        return await client.$transaction(async (transaction) => {
          const dimensions = await transaction.canvasState.findUniqueOrThrow({
            where: { id: 1 },
            select: { width: true, height: true },
          })
          if (pixels.some(({ x, y }) => !isInsideCanvas(x, y, dimensions))) {
            throw badRequest('Ce modèle n’est pas accepté.', 'INVALID_INPUT')
          }
          const agent = await transaction.drawingAgent.create({
            data: { accountId, pixels: JSON.stringify(pixels), startedAt },
          })
          return toAgentRecord(agent)
        })
      } catch (error) {
        if (error?.code === 'P2002') return null
        throw error
      }
    },

    async findAgent(accountId) {
      const agent = await client.drawingAgent.findUnique({ where: { accountId } })
      return agent ? toAgentRecord(agent) : null
    },

    async hasAgent(accountId) {
      return (await client.drawingAgent.count({ where: { accountId } })) > 0
    },

    async deleteAgent(accountId) {
      await client.drawingAgent.deleteMany({ where: { accountId } })
    },

    // Les comptes dont l'agent travaille : sert à relancer les agents au démarrage du serveur.
    async listAgentAccountIds() {
      const agents = await client.drawingAgent.findMany({ select: { accountId: true } })
      return agents.map(({ accountId }) => accountId)
    },

    findAccount(accountId) {
      return client.account.findUnique({
        where: { id: accountId },
        select: { id: true, teamId: true, bannedAt: true },
      })
    },

    // Les pixels visibles d'un rectangle de la toile, coins inclus.
    findVisiblePixels({ fromX, fromY, toX, toY }) {
      return client.pixel.findMany({
        where: { x: { gte: fromX, lte: toX }, y: { gte: fromY, lte: toY } },
        select: { x: true, y: true, color: true },
      })
    },

    // L'heure de la dernière pose du compte, ou null. accountId est écrit en texte dans l'historique.
    async findLastPlacementAt(accountId) {
      const placement = await client.pixelPlacement.findFirst({
        where: { accountId: String(accountId) },
        orderBy: { placedAt: 'desc' },
        select: { placedAt: true },
      })
      return placement ? placement.placedAt : null
    },
  }
}

export const agentRepository = createAgentRepository()
