// Donne ou retire le rôle admin à un compte existant. Aucune route ne le permet :
// le rôle se change depuis le serveur, par une personne qui a accès à la base.
// Usage : npm run account:role --prefix back -- <pseudo> <admin|player>
import { prisma } from '../src/canvas/canvas-repository.js'

const ROLES = ['admin', 'player']
const [pseudo, role] = process.argv.slice(2)

if (!pseudo || !ROLES.includes(role)) {
  console.error('Usage : npm run account:role --prefix back -- <pseudo> <admin|player>')
  process.exitCode = 1
} else {
  try {
    // updateMany ne lève pas d'erreur quand aucun compte ne correspond : le compte se lit dans count.
    const { count } = await prisma.account.updateMany({
      where: { pseudoKey: pseudo.trim().toLowerCase() },
      data: { role },
    })
    if (count === 0) {
      console.error(`Aucun compte n'a le pseudo « ${pseudo} ». Le compte doit d'abord être créé.`)
      process.exitCode = 1
    } else {
      console.log(`Le compte « ${pseudo} » a maintenant le rôle ${role}.`)
    }
  } finally {
    await prisma.$disconnect()
  }
}
