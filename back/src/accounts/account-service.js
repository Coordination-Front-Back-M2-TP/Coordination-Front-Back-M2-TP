import { createHash, randomBytes } from 'node:crypto'
import { badRequest, conflict, unauthorized } from '../errors/app-error.js'
import { hashPassword, UNKNOWN_ACCOUNT_HASH, verifyPassword } from './password.js'

export const ADMIN_ROLE = 'admin'
export const PLAYER_ROLE = 'player'

const PSEUDO_PATTERN = /^[A-Za-z0-9_-]{3,20}$/
const MIN_PASSWORD_LENGTH = 8
const MAX_PASSWORD_LENGTH = 128
// Durée proposée par le contrat ; sa valeur définitive reste à confirmer par l'équipe.
const DEFAULT_SESSION_DAYS = 30
const DAY_MS = 24 * 60 * 60 * 1000

// Lit la durée d'une session dans SESSION_TTL_DAYS. Une valeur absente, vide, nulle,
// négative ou illisible donne la durée par défaut.
export function readSessionTtlMs(env = process.env) {
  const raw = env.SESSION_TTL_DAYS
  const days = raw === undefined || String(raw).trim() === '' ? Number.NaN : Number(raw)
  return Math.round((Number.isFinite(days) && days > 0 ? days : DEFAULT_SESSION_DAYS) * DAY_MS)
}

// Le jeton ne sort du serveur que dans le cookie : la base n'en garde que l'empreinte.
function hashToken(token) {
  return createHash('sha256').update(token).digest('hex')
}

function invalidInput() {
  return badRequest('Ce pseudo ou ce mot de passe n’est pas accepté.', 'INVALID_INPUT')
}

function invalidCredentials() {
  return unauthorized('Pseudo ou mot de passe incorrect.', 'INVALID_CREDENTIALS')
}

// Seuls pseudo et password sont lus dans le corps : un champ en trop n'atteint pas la base.
function readCredentials(body) {
  if (!body || typeof body !== 'object' || typeof body.pseudo !== 'string' || typeof body.password !== 'string') {
    throw invalidInput()
  }
  return { pseudo: body.pseudo.trim(), password: body.password }
}

// Ce que l'API montre d'un compte. team vaut null tant que le joueur n'a pas choisi d'équipe.
// role sert au front à montrer les outils de modération ; les routes le revérifient toujours.
export function toUser(account) {
  return {
    pseudo: account.pseudo,
    team: account.team ?? null,
    role: account.role === ADMIN_ROLE ? ADMIN_ROLE : PLAYER_ROLE,
  }
}

export function createAccountService({ repository, now = () => new Date(), sessionTtlMs = readSessionTtlMs() }) {
  function prepareSession(createdAt = now()) {
    const token = randomBytes(32).toString('base64url')
    const expiresAt = new Date(createdAt.getTime() + sessionTtlMs)
    return {
      session: { token, expiresAt },
      record: { tokenHash: hashToken(token), createdAt, expiresAt },
    }
  }

  async function openSession(account) {
    const { session, record } = prepareSession()
    await repository.createSession({ ...record, accountId: account.id })
    return { user: toUser(account), session }
  }

  return {
    // Crée le compte et connecte le joueur : renvoie { user, session: { token, expiresAt } }.
    async register(body) {
      const { pseudo, password } = readCredentials(body)
      if (!PSEUDO_PATTERN.test(pseudo)
        || password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
        throw invalidInput()
      }

      const passwordHash = await hashPassword(password)
      const createdAt = now()
      const { session, record } = prepareSession(createdAt)
      const account = await repository.createAccountWithSession(
        { pseudo, pseudoKey: pseudo.toLowerCase(), passwordHash, createdAt },
        record,
      )
      if (!account) throw conflict('Ce pseudo est déjà pris.', 'PSEUDO_TAKEN')
      return { user: toUser(account), session }
    },

    async login(body) {
      const { pseudo, password } = readCredentials(body)
      // Un mot de passe trop long ne peut être celui d'aucun compte : inutile de le hacher.
      if (password.length > MAX_PASSWORD_LENGTH) throw invalidCredentials()

      const account = await repository.findAccountByPseudoKey(pseudo.toLowerCase())
      const matches = await verifyPassword(password, account ? account.passwordHash : UNKNOWN_ACCOUNT_HASH)
      // Même réponse pour un pseudo inconnu et un mot de passe faux : elle ne dit pas si le pseudo existe.
      if (!account || !matches) throw invalidCredentials()

      await repository.deleteExpiredSessions(account.id, now())
      return openSession(account)
    },

    async logout(token) {
      if (token) await repository.deleteSession(hashToken(token))
    },

    // Renvoie le compte de la session, ou null si le jeton est absent, inconnu ou expiré.
    async getAccount(token) {
      if (!token) return null
      const tokenHash = hashToken(token)
      const session = await repository.findSession(tokenHash)
      if (!session) return null
      if (session.expiresAt.getTime() <= now().getTime()) {
        await repository.deleteSession(tokenHash)
        return null
      }
      return session.account
    },
  }
}
