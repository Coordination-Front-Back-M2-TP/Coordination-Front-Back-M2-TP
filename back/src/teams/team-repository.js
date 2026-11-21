import { prisma } from '../canvas/canvas-repository.js'

export function createTeamRepository(client = prisma) {
  return {
    listTeams() {
      return client.team.findMany({ orderBy: { sequence: 'asc' }, select: { id: true, name: true, color: true } })
    },

    findTeam(teamId) {
      return client.team.findUnique({ where: { id: teamId }, select: { id: true, name: true, color: true } })
    },

    async findAccount(accountId) {
      const account = await client.account.findUnique({ where: { id: accountId } })
      if (!account) return null
      const team = account.teamId ? await client.team.findUnique({ where: { id: account.teamId }, select: { id: true, name: true, color: true } }) : null
      return { ...account, team }
    },

    async createAndJoin({ accountId, team, changedAt, changedBefore }) {
      return client.$transaction(async (tx) => {
        const { count } = await tx.account.updateMany({
          where: { id: accountId, bannedAt: null, OR: [{ teamChangedAt: null }, { teamChangedAt: { lte: changedBefore } }] },
          data: { teamId: team.id, teamChangedAt: changedAt },
        })
        if (!count) return null
        await tx.team.create({ data: team })
        const account = await tx.account.findUniqueOrThrow({ where: { id: accountId } })
        return { ...account, team }
      })
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
