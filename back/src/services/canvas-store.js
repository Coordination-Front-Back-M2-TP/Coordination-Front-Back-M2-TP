import { EventEmitter } from 'node:events'
import { badRequest } from '../errors/app-error.js'

// Résolution actée par le contrat (docs/contrat-api.md) : 101 × 101, origine au centre,
// coordonnées entières de -50 à 50 inclus, x vers la droite, y vers le bas.
export const CANVAS_WIDTH = 101
export const CANVAS_HEIGHT = 101
const COORDINATE_MIN = -50
const COORDINATE_MAX = 50
const COLOR_PATTERN = /^#[0-9a-f]{6}$/i

function isValidCoordinate(value) {
  return Number.isSafeInteger(value) && value >= COORDINATE_MIN && value <= COORDINATE_MAX
}

// Stockage de la toile en mémoire : le projet n'a pas encore de base de données et la
// démo tient dans un processus unique. La Map est indexée par coordonnée (« x,y ») et ne
// garde que l'état courant de chaque pixel (représentation creuse). Quand une persistance
// sera branchée, seule l'implémentation interne de placePixel et getSnapshot changera :
// le contrat renvoyé (Pixel, instantané, événement) reste identique.
export function createCanvasStore() {
  const pixels = new Map()
  let revision = 0
  const events = new EventEmitter()

  // Enregistre un pixel et attribue sa révision de façon atomique : le processus Node est
  // mono-thread et toute la fonction est synchrone, donc deux poses ne peuvent ni partager
  // une révision ni s'intercaler entre l'écriture et l'incrément. L'événement
  // « pixel:updated » est émis après l'écriture, pour ne jamais annoncer un état non persisté.
  // #44 branchera cette fonction sur la route d'écriture ; le cooldown et l'authentification
  // seront vérifiés avant l'appel, pas ici.
  function placePixel({ x, y, color }) {
    if (!isValidCoordinate(x) || !isValidCoordinate(y)) {
      throw badRequest(
        `Coordonnées hors de la toile : x et y sont des entiers entre ${COORDINATE_MIN} et ${COORDINATE_MAX}.`,
        'INVALID_INPUT',
      )
    }
    if (typeof color !== 'string' || !COLOR_PATTERN.test(color)) {
      throw badRequest('Couleur invalide : le format attendu est #RRGGBB.', 'INVALID_INPUT')
    }

    revision += 1
    const pixel = { x, y, color, updatedAt: new Date().toISOString(), revision }
    pixels.set(`${x},${y}`, pixel)
    events.emit('pixel:updated', pixel)
    return pixel
  }

  function getSnapshot() {
    return {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      revision,
      snapshotAt: new Date().toISOString(),
      pixels: [...pixels.values()],
    }
  }

  return { placePixel, getSnapshot, events }
}

// Instance partagée par l'application (route HTTP et passerelle Socket.IO).
export const canvasStore = createCanvasStore()
