import { useEffect, useRef, useState } from 'react'
import { PALETTE } from '../../api/palette.js'
import { placePixel } from '../../api/pixels.js'
import { useCooldown } from '../../hooks/use-cooldown.js'
import { ColorPalette } from '../ColorPalette/ColorPalette.jsx'
import { PixelCanvas } from '../PixelCanvas/PixelCanvas.jsx'
import styles from './PixelPlacer.module.css'

const SIGN_IN_MESSAGE = 'Connectez-vous pour poser un pixel.'
const TEAM_REQUIRED_MESSAGE = 'Choisissez une équipe avant de poser un pixel.'

// Les messages sont fixes : le texte d'erreur du serveur n'est jamais inséré dans l'interface.
function errorMessage(error) {
  switch (error?.code) {
    case 'UNAUTHORIZED':
      return SIGN_IN_MESSAGE
    case 'TEAM_REQUIRED':
      return TEAM_REQUIRED_MESSAGE
    case 'COOLDOWN_ACTIVE':
      return 'Attendez la fin de votre délai avant de poser un autre pixel.'
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
  // Sur téléphone, on pose en touchant la toile : la saisie par coordonnées se replie derrière un bouton.
  const [showCoordinates, setShowCoordinates] = useState(false)
  const controller = useRef(null)
  const { seconds, startCooldown } = useCooldown()
  const coolingDown = seconds > 0
  const placementDisabled = pending || coolingDown

  useEffect(() => () => controller.current?.abort(), [])

  if (user === null || user?.team === null) {
    return (
      <>
        <PixelCanvas canvas={canvas} />
        <div className={`hud ${styles.dock}`}>
          <p>{user === null ? SIGN_IN_MESSAGE : TEAM_REQUIRED_MESSAGE}</p>
        </div>
      </>
    )
  }

  const minX = -Math.floor(canvas.width / 2)
  const maxX = canvas.width - 1 + minX
  const minY = -Math.floor(canvas.height / 2)
  const maxY = canvas.height - 1 + minY

  async function place({ x, y }) {
    // Une seule pose à la fois : un double clic n'envoie pas deux requêtes, même avant le rendu suivant.
    if (controller.current || coolingDown) return
    const current = new AbortController()
    controller.current = current
    setPending(true)
    setFeedback(null)
    try {
      // La toile se met à jour avec pixel:updated, que le serveur diffuse aussi au joueur qui a posé.
      const { pixel, cooldownEndsAt } = await placePixel({ x, y, color }, current.signal)
      if (current.signal.aborted) return
      // Les deux dates viennent du serveur : un décalage de l’horloge locale ne change pas le délai.
      startCooldown(Date.parse(cooldownEndsAt) - Date.parse(pixel.updatedAt))
      setFeedback({ kind: 'success', text: `Pixel ${colorName(pixel.color).toLowerCase()} posé en (${pixel.x}, ${pixel.y}).` })
    } catch (error) {
      if (current.signal.aborted) return
      if (error?.code === 'COOLDOWN_ACTIVE' && error.retryAfterSeconds !== undefined) {
        startCooldown(error.retryAfterSeconds * 1000)
      } else {
        setFeedback({ kind: 'error', text: errorMessage(error) })
      }
    } finally {
      if (!current.signal.aborted) {
        controller.current = null
        setPending(false)
      }
    }
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (placementDisabled) return
    const x = Number(coordinates.x)
    const y = Number(coordinates.y)
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < minX || x > maxX || y < minY || y > maxY) {
      setFeedback({ kind: 'error', text: `Choisissez x entre ${minX} et ${maxX}, et y entre ${minY} et ${maxY}.` })
      return
    }
    place({ x, y })
  }

  // La toile d'abord, puis le dock : tout ce qui sert à poser, au même endroit, en bas de l'écran.
  return (
    <>
      <PixelCanvas canvas={canvas} onSelectCell={placementDisabled ? undefined : place} />
      <div className={`hud ${styles.dock}`}>
        <ColorPalette colors={PALETTE} value={color} onChange={setColor} disabled={pending} />
        <p className={styles.hint}>
          Cliquez sur une case pour y poser la couleur choisie. Glissez pour vous déplacer, molette pour zoomer.
        </p>
        <div className={styles.controls}>
          <button type="button" className={`secondary ${styles.coordinatesToggle}`} aria-expanded={showCoordinates}
            onClick={() => setShowCoordinates((shown) => !shown)}>
            {showCoordinates ? 'Masquer les coordonnées' : 'Coordonnées'}
          </button>
          <form className={showCoordinates ? styles.form : `${styles.form} ${styles.collapsed}`} onSubmit={handleSubmit} aria-label="Poser un pixel par ses coordonnées">
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
            <button type="submit" disabled={placementDisabled}>{pending ? 'Pose en cours…' : 'Poser le pixel'}</button>
          </form>
          {coolingDown && (
            <p role="timer" aria-live="off" className={styles.timer}>Prochaine pose dans {seconds} s.</p>
          )}
        </div>
        {/* Annonce pour les lecteurs d'écran : à l'écran, le compte à rebours suffit. */}
        <p aria-live="polite" className="visually-hidden">
          {coolingDown && 'Délai de pose en cours.'}
          {seconds === 0 && 'Vous pouvez poser un pixel.'}
        </p>
        {/* Zone toujours présente : un lecteur d'écran annonce le résultat de chaque pose. */}
        <p aria-live="polite" className={feedback?.kind === 'error' ? `${styles.feedback} ${styles.error}` : styles.feedback}>
          {feedback?.text}
        </p>
      </div>
    </>
  )
}
