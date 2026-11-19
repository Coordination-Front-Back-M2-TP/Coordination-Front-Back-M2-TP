import { prisma } from '../canvas/canvas-repository.js'

export function createRankingRepository(client = prisma) {
  return {
    // Compte, pour chaque équipe, les pixels visibles dont elle a fait la dernière pose.
    // La révision d'un pixel visible est celle de la pose qui l'a écrit en dernier : la jointure
    // ne garde donc qu'une pose par case, la plus récente. Une pose remplacée ne compte plus.
    // Une pose sans équipe (joueur qui n'en a pas encore choisi) ne compte pour personne.
    async countPixelsByTeam() {
      return client.$transaction(async (transaction) => {
        const state = await transaction.canvasState.findUniqueOrThrow({ where: { id: 1 } })
        const rows = await transaction.$queryRaw`
          SELECT placement."teamId" AS "teamId", COUNT(*) AS "pixelCount"
          FROM "PixelPlacement" AS placement
          JOIN "Pixel" AS pixel ON pixel."revision" = placement."revision"
          WHERE placement."teamId" IS NOT NULL
          GROUP BY placement."teamId"
        `

        return {
          revision: state.revision,
          // SQLite renvoie le compte en BigInt, que JSON ne sait pas écrire.
          counts: rows.map((row) => ({ teamId: row.teamId, pixelCount: Number(row.pixelCount) })),
        }
      })
    },
  }
}

export const rankingRepository = createRankingRepository()
