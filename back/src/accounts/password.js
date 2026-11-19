import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scryptAsync = promisify(scrypt)

// Réglages de scrypt. Ils sont écrits dans chaque empreinte : les durcir plus tard
// ne casse pas les mots de passe déjà enregistrés.
const COST = 32768
const BLOCK_SIZE = 8
const PARALLELIZATION = 1
const KEY_LENGTH = 64
const SALT_LENGTH = 16
// scrypt demande environ 128 × COST × BLOCK_SIZE octets : la limite par défaut de Node (32 Mo) est trop juste.
const MAX_MEMORY = 64 * 1024 * 1024

function derive(password, salt, { cost, blockSize, parallelization, keyLength }) {
  return scryptAsync(password, salt, keyLength, { N: cost, r: blockSize, p: parallelization, maxmem: MAX_MEMORY })
}

// Renvoie « scrypt$coût$bloc$parallélisme$sel$empreinte ». Le sel est tiré au hasard pour chaque mot de passe.
export async function hashPassword(password) {
  const salt = randomBytes(SALT_LENGTH)
  const key = await derive(password, salt, {
    cost: COST,
    blockSize: BLOCK_SIZE,
    parallelization: PARALLELIZATION,
    keyLength: KEY_LENGTH,
  })
  return ['scrypt', COST, BLOCK_SIZE, PARALLELIZATION, salt.toString('base64'), key.toString('base64')].join('$')
}

export async function verifyPassword(password, passwordHash) {
  const [scheme, cost, blockSize, parallelization, salt, key] = String(passwordHash).split('$')
  if (scheme !== 'scrypt' || !key) return false
  const expected = Buffer.from(key, 'base64')
  const actual = await derive(password, Buffer.from(salt, 'base64'), {
    cost: Number(cost),
    blockSize: Number(blockSize),
    parallelization: Number(parallelization),
    keyLength: expected.length,
  })
  // Comparaison à temps constant : sa durée ne dit pas combien d'octets sont justes.
  return timingSafeEqual(actual, expected)
}

// Empreinte d'un mot de passe que personne ne connaît. La connexion la vérifie quand le pseudo
// est inconnu, pour répondre dans le même temps que pour un mot de passe faux.
export const UNKNOWN_ACCOUNT_HASH = await hashPassword(randomBytes(32).toString('base64'))
