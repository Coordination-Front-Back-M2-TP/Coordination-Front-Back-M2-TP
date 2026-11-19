// Affiche les pixels visibles de la base pointée par DATABASE_URL (démo de migration, docs/demos-oral.md).
// Requête SQL brute : le script marche avant et après la migration, quelles que soient les colonnes.
import { prisma } from '../src/canvas/canvas-repository.js'

try {
  console.table(await prisma.$queryRawUnsafe('SELECT * FROM "Pixel" ORDER BY "y", "x"'))
} finally {
  await prisma.$disconnect()
}
