import { prisma } from '../canvas/canvas-repository.js'

export function createAccountRepository(client = prisma) {
  async function withTeam(account) {
    if (!account) return null
    const team = account.teamId ? await client.team.findUnique({ where: { id: account.teamId }, select: { id: true, name: true, color: true } }) : null
    return { ...account, team }
  }
  return {
    // Renvoie le compte créé, ou null si le pseudo est déjà pris. L'unicité est tenue par la base :
    // deux inscriptions simultanées avec le même pseudo ne peuvent pas passer toutes les deux.
    async createAccountWithSession({ pseudo, pseudoKey, passwordHash, createdAt }, session) {
      return client.$transaction(async (transaction) => {
        let account
        try {
          account = await transaction.account.create({ data: { pseudo, pseudoKey, passwordHash, createdAt } })
        } catch (error) {
          if (error?.code === 'P2002') return null
          throw error
        }
        // Une erreur de session annule aussi le compte et libère le pseudo pour une nouvelle tentative.
        await transaction.session.create({ data: { ...session, accountId: account.id } })
        return account
      })
    },

    async findAccountByPseudoKey(pseudoKey) {
      return withTeam(await client.account.findUnique({ where: { pseudoKey } }))
    },

    async createSession({ tokenHash, accountId, createdAt, expiresAt }) {
      await client.session.create({ data: { tokenHash, accountId, createdAt, expiresAt } })
    },

    // Renvoie { expiresAt, account }, ou null si aucune session n'a ce jeton.
    async findSession(tokenHash) {
      const session = await client.session.findUnique({
        where: { tokenHash },
        select: { expiresAt: true, account: true },
      })
      return session ? { ...session, account: await withTeam(session.account) } : null
    },

    async deleteSession(tokenHash) {
      await client.session.deleteMany({ where: { tokenHash } })
    },

    async deleteExpiredSessions(accountId, now) {
      await client.session.deleteMany({ where: { accountId, expiresAt: { lte: now } } })
    },
  }
}

export const accountRepository = createAccountRepository()
