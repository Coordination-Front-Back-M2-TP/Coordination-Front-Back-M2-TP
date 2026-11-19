import { prisma } from '../canvas/canvas-repository.js'

export function createTeamRepository(client = prisma) {
  return {
    findAccount(accountId) {
      return client.account.findUnique({ where: { id: accountId } })
    },

    // Inscrit l'équipe du compte, seulement si son dernier changement date d'avant changedBefore
    // (ou s'il n'a jamais choisi d'équipe). La condition est dans la requête d'écriture : deux
    // changements simultanés ne peuvent pas passer tous les deux. Renvoie true si l'équipe a changé.
    async changeTeam({ accountId, teamId, changedAt, changedBefore }) {
      const { count } = await client.account.updateMany({
        where: {
          id: accountId,
          OR: [{ teamChangedAt: null }, { teamChangedAt: { lte: changedBefore } }],
        },
        data: { teamId, teamChangedAt: changedAt },
      })
      return count === 1
    },
  }
}

export const teamRepository = createTeamRepository()
