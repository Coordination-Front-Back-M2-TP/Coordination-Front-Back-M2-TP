import { useEffect, useId, useRef, useState } from 'react'
import { HudPortal } from '../HudPortal/HudPortal.jsx'
import { useCanvasNavigation } from './use-canvas-navigation.js'
import styles from './PixelCanvas.module.css'

// Traduit un clic en coordonnées de case à partir de la position affichée de la toile.
function cellFromPoint(event, element, { width, height }) {
  const rect = element.getBoundingClientRect()
  if (!element.clientWidth || !element.clientHeight) return null
  const column = Math.floor(((event.clientX - rect.left - element.clientLeft) / element.clientWidth) * width)
  const row = Math.floor(((event.clientY - rect.top - element.clientTop) / element.clientHeight) * height)
  if (column < 0 || column >= width || row < 0 || row >= height) return null
  return { x: column - Math.floor(width / 2), y: row - Math.floor(height / 2) }
}

// Sans onSelectCell, la toile reste en lecture seule : c'est le cas d'un visiteur sans compte.
// La toile couvre l'écran ; le zoom et la liste des pixels en texte vont dans le HUD (HudPortal).
export function PixelCanvas({ canvas, onSelectCell }) {
  const ref = useRef(null)
  const captionId = useId()
  const [showPixels, setShowPixels] = useState(false)
  const [canDraw, setCanDraw] = useState(true)
  const navigationId = useId()
  const { zoom, isOverview, canZoomIn, canZoomOut, zoomIn, zoomOut, reset, viewportProps } = useCanvasNavigation(canDraw, selectCell)
  const count = canvas.pixels.size

  function selectCell(event) {
    if (!onSelectCell) return
    const cell = cellFromPoint(event, ref.current, canvas)
    if (cell) onSelectCell(cell)
  }

  useEffect(() => {
    if (!ref.current) return
    const context = ref.current.getContext('2d')
    if (!context) {
      setCanDraw(false)
      setShowPixels(true)
      return
    }
    context.imageSmoothingEnabled = false
    context.clearRect(0, 0, canvas.width, canvas.height)
    for (const pixel of canvas.pixels.values()) {
      context.fillStyle = pixel.color
      context.fillRect(pixel.x + Math.floor(canvas.width / 2), pixel.y + Math.floor(canvas.height / 2), 1, 1)
    }
  }, [canvas])

  return (
    <figure className={styles.figure}>
      {canDraw ? (
        <>
          <p id={navigationId} className="visually-hidden">
            Zoomez à la molette, en pinçant ou avec les touches + et -, et revenez à la vue d’ensemble avec 0.
            Déplacez la toile en la faisant glisser ou avec les flèches du clavier.
          </p>
          <div
            {...viewportProps}
            className={styles.viewport}
            role="region"
            aria-label="Navigation sur la toile"
            aria-describedby={navigationId}
            tabIndex={0}
            style={{ '--canvas-zoom': zoom }}
          >
            <canvas
              ref={ref}
              width={canvas.width}
              height={canvas.height}
              className={onSelectCell ? `${styles.canvas} ${styles.selectable}` : styles.canvas}
              style={{ '--cols': canvas.width, '--rows': canvas.height }}
              onClick={onSelectCell ? selectCell : undefined}
              role="img"
              aria-label={`Toile partagée de ${canvas.width} par ${canvas.height} pixels`}
              aria-describedby={captionId}
            >
              Les coordonnées et les couleurs sont disponibles dans la liste des pixels ci-dessous.
            </canvas>
          </div>
        </>
      ) : <p role="alert">L’affichage graphique est indisponible. Consultez les pixels en texte ci-dessous.</p>}
      <figcaption id={captionId} className="visually-hidden">
        {count === 0 ? 'Aucun pixel posé.' : `${count} pixel${count > 1 ? 's' : ''} coloré${count > 1 ? 's' : ''}.`}
        {' '}Le damier représente les cases vides. L’origine (0, 0) est au centre.
      </figcaption>
      <HudPortal>
        {canDraw && (
          <div className={`hud ${styles.controls}`} role="group" aria-label="Zoom de la toile">
            <button type="button" className="secondary" onClick={zoomIn} disabled={!canZoomIn} aria-label="Zoomer">+</button>
            <button type="button" className="secondary" onClick={zoomOut} disabled={!canZoomOut} aria-label="Dézoomer">−</button>
            <button type="button" className="secondary" onClick={reset} disabled={isOverview}>Vue d’ensemble</button>
          </div>
        )}
        <details className={`hud ${styles.details}`} open={!canDraw || undefined}
          onToggle={(event) => setShowPixels(event.currentTarget.open || !canDraw)}>
          <summary>Consulter les pixels en texte</summary>
          {showPixels && (
            <ul className={styles.pixels} tabIndex={0} aria-label="Coordonnées et couleurs des pixels">
              {Array.from(canvas.pixels.values(), (pixel) => (
                <li key={`${pixel.x},${pixel.y}`}>({pixel.x}, {pixel.y}) : {pixel.color}</li>
              ))}
            </ul>
          )}
        </details>
      </HudPortal>
    </figure>
  )
}
