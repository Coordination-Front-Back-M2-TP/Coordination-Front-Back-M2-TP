import { prisma } from '../canvas/canvas-repository.js'

export function createAccountRepository(client = prisma) {
  return {
    // Renvoie le compte créé, ou null si le pseudo est déjà pris. L'unicité est tenue par la base :
    // deux inscriptions simultanées avec le même pseudo ne peuvent pas passer toutes les deux.
    async createAccount({ pseudo, pseudoKey, passwordHash, createdAt }) {
      try {
        return await client.account.create({ data: { pseudo, pseudoKey, passwordHash, createdAt } })
      } catch (error) {
        if (error?.code === 'P2002') return null
        throw error
      }
    },

    findAccountByPseudoKey(pseudoKey) {
      return client.account.findUnique({ where: { pseudoKey } })
    },

    async createSession({ tokenHash, accountId, createdAt, expiresAt }) {
      await client.session.create({ data: { tokenHash, accountId, createdAt, expiresAt } })
    },

    // Renvoie { expiresAt, account }, ou null si aucune session n'a ce jeton.
    findSession(tokenHash) {
      return client.session.findUnique({
        where: { tokenHash },
        select: { expiresAt: true, account: true },
      })
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
