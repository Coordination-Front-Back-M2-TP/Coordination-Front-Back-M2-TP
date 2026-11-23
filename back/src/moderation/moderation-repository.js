import { ADMIN_ROLE } from '../accounts/account-service.js'
import { prisma } from '../canvas/canvas-repository.js'
import { conflict, notFound } from '../errors/app-error.js'

export const ZONE_CLEANUP = 'zone_cleanup'
export const PLAYER_BAN = 'player_ban'
// Un bannissement relit une case après l'autre : il lui faut plus que les 5 secondes par défaut de Prisma.
const BAN_TRANSACTION_TIMEOUT_MS = 30_000

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

function isInZone(zone, x, y) {
  return x >= zone.fromX && x <= zone.toX && y >= zone.fromY && y <= zone.toY
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

    // Bannit le compte, retire son agent, annule ses poses visibles et note l'action dans une transaction.
    // Chaque case qui montre un pixel du joueur reprend le pixel d'avant lui, d'après l'historique ;
    // sans pixel d'avant, elle redevient vide. L'historique des poses n'est pas touché.
    // Renvoie { action, restored, cleared } : les pixels remis et les cases vidées.
    async banPlayer(pseudoKey, admin) {
      return client.$transaction(async (transaction) => {
        // Même verrou d'écriture que la pose : une pose simultanée du joueur passe avant, et elle
        // est annulée ici, ou après, et elle est refusée (canvas-repository.js).
        const state = await transaction.canvasState.update({
          where: { id: 1 },
          data: { revision: { increment: 1 } },
        })
        const account = await transaction.account.findUnique({ where: { pseudoKey } })
        if (!account) throw notFound('Aucun compte n’a ce pseudo.', 'PLAYER_NOT_FOUND')
        if (account.role === ADMIN_ROLE) throw conflict('Un compte admin ne peut pas être banni.', 'ADMIN_NOT_BANNABLE')
        if (account.bannedAt) throw conflict('Ce joueur est déjà banni.', 'ALREADY_BANNED')

        const bannedAt = now()
        await transaction.account.update({ where: { id: account.id }, data: { bannedAt } })
        await transaction.drawingAgent.deleteMany({ where: { accountId: account.id } })

        // Le pixel d'avant ne vient jamais d'un compte banni, celui-ci compris.
        const bannedAccounts = await transaction.account.findMany({
          where: { bannedAt: { not: null } },
          select: { id: true },
        })
        const bannedIds = bannedAccounts.map(({ id }) => String(id))
        const cleanups = (await transaction.moderationAction.findMany({
          where: { type: ZONE_CLEANUP },
          select: { details: true },
        })).map(({ details }) => JSON.parse(details))

        // Un pixel visible porte la révision de la pose qui l'a mis là : c'est elle qui dit à qui il est.
        const cells = await transaction.$queryRaw`
          SELECT p.x AS x, p.y AS y
          FROM Pixel p
          JOIN PixelPlacement pp ON pp.revision = p.revision
          WHERE pp.accountId = ${String(account.id)}
          ORDER BY p.y, p.x`

        const restored = []
        const cleared = []
        for (const cell of cells) {
          const x = Number(cell.x)
          const y = Number(cell.y)
          const previous = await transaction.pixelPlacement.findFirst({
            where: { x, y, accountId: { notIn: bannedIds } },
            orderBy: { revision: 'desc' },
          })
          // Une case nettoyée après la pose d'avant était vide quand le joueur banni y a posé.
          const wasCleaned = previous
            && cleanups.some((zone) => zone.revision > previous.revision && isInZone(zone, x, y))
          if (!previous || wasCleaned) {
            await transaction.pixel.delete({ where: { x_y: { x, y } } })
            cleared.push({ x, y })
          } else {
            // Le pixel reprend aussi l'heure et la révision de la pose d'avant : il reste rattaché
            // à cette pose, donc à son joueur et à son équipe.
            await transaction.pixel.update({
              where: { x_y: { x, y } },
              data: { color: previous.color, updatedAt: previous.placedAt, revision: previous.revision },
            })
            restored.push({
              x,
              y,
              color: previous.color,
              updatedAt: previous.placedAt.toISOString(),
              revision: previous.revision,
            })
          }
        }

        const action = await transaction.moderationAction.create({
          data: {
            type: PLAYER_BAN,
            adminAccountId: admin.id,
            adminPseudo: admin.pseudo,
            createdAt: bannedAt,
            details: JSON.stringify({
              pseudo: account.pseudo,
              restoredCount: restored.length,
              clearedCount: cleared.length,
              revision: state.revision,
            }),
          },
        })
        return { action: toActionRecord(action), restored, cleared }
      }, { timeout: BAN_TRANSACTION_TIMEOUT_MS })
    },

    // Les comptes dans l'ordre des pseudos. after : clé du dernier pseudo déjà lu, ou null.
    async listPlayers({ after = null, limit }) {
      const accounts = await client.account.findMany({
        where: after === null ? {} : { pseudoKey: { gt: after } },
        orderBy: { pseudoKey: 'asc' },
        take: limit,
        select: { pseudo: true, teamId: true, role: true, bannedAt: true },
      })
      const teams = await client.team.findMany({ select: { id: true, name: true, color: true } })
      const byId = new Map(teams.map((team) => [team.id, team]))
      return accounts.map((account) => ({ ...account, team: byId.get(account.teamId) ?? null }))
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
