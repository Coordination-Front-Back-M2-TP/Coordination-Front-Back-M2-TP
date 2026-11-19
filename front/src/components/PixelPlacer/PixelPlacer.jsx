import { useEffect, useRef, useState } from 'react'
import { PALETTE } from '../../api/palette.js'
import { placePixel } from '../../api/pixels.js'
import { ColorPalette } from '../ColorPalette/ColorPalette.jsx'
import { PixelCanvas } from '../PixelCanvas/PixelCanvas.jsx'
import styles from './PixelPlacer.module.css'

const SIGN_IN_MESSAGE = 'Connectez-vous pour poser un pixel.'

// Les messages sont fixes : le texte d'erreur du serveur n'est jamais inséré dans l'interface.
function errorMessage(error) {
  switch (error?.code) {
    case 'UNAUTHORIZED':
      return SIGN_IN_MESSAGE
    case 'COOLDOWN_ACTIVE':
      return error.retryAfterSeconds === undefined
        ? 'Attendez la fin de votre délai avant de poser un autre pixel.'
        : `Attendez encore ${error.retryAfterSeconds} seconde${error.retryAfterSeconds > 1 ? 's' : ''} avant de poser un autre pixel.`
    case 'INVALID_INPUT':
      return 'Cette case ou cette couleur n’est pas acceptée.'
    default:
      return 'La pose a échoué. Réessayez dans un instant.'
  }
}

const colorName = (color) => PALETTE.find((entry) => entry.color === color)?.name ?? color

// user : undefined tant que la session n'est pas connue (le serveur tranche), null pour un visiteur, objet pour un joueur.
export function PixelPlacer({ canvas, user }) {
  const [color, setColor] = useState(PALETTE[0].color)
  const [pending, setPending] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [coordinates, setCoordinates] = useState({ x: '0', y: '0' })
  const controller = useRef(null)

  useEffect(() => () => controller.current?.abort(), [])

  if (user === null) {
    return (
      <>
        <p>{SIGN_IN_MESSAGE}</p>
        <PixelCanvas canvas={canvas} />
      </>
    )
  }

  const minX = -Math.floor(canvas.width / 2)
  const maxX = canvas.width - 1 + minX
  const minY = -Math.floor(canvas.height / 2)
  const maxY = canvas.height - 1 + minY

  async function place({ x, y }) {
    // Une seule pose à la fois : un double clic n'envoie pas deux requêtes, même avant le rendu suivant.
    if (controller.current) return
    const current = new AbortController()
    controller.current = current
    setPending(true)
    setFeedback(null)
    try {
      // La toile se met à jour avec pixel:updated, que le serveur diffuse aussi au joueur qui a posé.
      const { pixel } = await placePixel({ x, y, color }, current.signal)
      if (current.signal.aborted) return
      setFeedback({ kind: 'success', text: `Pixel ${colorName(pixel.color).toLowerCase()} posé en (${pixel.x}, ${pixel.y}).` })
    } catch (error) {
      if (current.signal.aborted) return
      setFeedback({ kind: 'error', text: errorMessage(error) })
    } finally {
      if (!current.signal.aborted) {
        controller.current = null
        setPending(false)
      }
    }
  }

  function handleSubmit(event) {
    event.preventDefault()
    const x = Number(coordinates.x)
    const y = Number(coordinates.y)
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < minX || x > maxX || y < minY || y > maxY) {
      setFeedback({ kind: 'error', text: `Choisissez x entre ${minX} et ${maxX}, et y entre ${minY} et ${maxY}.` })
      return
    }
    place({ x, y })
  }

  return (
    <>
      <ColorPalette colors={PALETTE} value={color} onChange={setColor} disabled={pending} />
      <p>Cliquez sur une case de la toile pour y poser la couleur choisie.</p>
      <PixelCanvas canvas={canvas} onSelectCell={place} />
      <form className={styles.form} onSubmit={handleSubmit} aria-label="Poser un pixel par ses coordonnées">
        <label>
          Colonne (x)
          <input
            type="number"
            min={minX}
            max={maxX}
            step={1}
            required
            value={coordinates.x}
            onChange={(event) => setCoordinates((value) => ({ ...value, x: event.target.value }))}
          />
        </label>
        <label>
          Ligne (y)
          <input
            type="number"
            min={minY}
            max={maxY}
            step={1}
            required
            value={coordinates.y}
            onChange={(event) => setCoordinates((value) => ({ ...value, y: event.target.value }))}
          />
        </label>
        <button type="submit" disabled={pending}>{pending ? 'Pose en cours…' : 'Poser le pixel'}</button>
      </form>
      {/* Zone toujours présente : un lecteur d'écran annonce le résultat de chaque pose. */}
      <p aria-live="polite" className={feedback?.kind === 'error' ? styles.error : undefined}>{feedback?.text}</p>
    </>
  )
}
