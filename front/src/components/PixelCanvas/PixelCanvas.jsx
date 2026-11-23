import { useEffect, useId, useRef, useState } from 'react'
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
export function PixelCanvas({ canvas, onSelectCell, preview }) {
  const ref = useRef(null)
  const captionId = useId()
  const [showPixels, setShowPixels] = useState(false)
  const [canDraw, setCanDraw] = useState(true)
  const navigationId = useId()
  const { canZoomIn, canZoomOut, zoomIn, zoomOut, reset, viewportProps } = useCanvasNavigation(canDraw, selectCell)
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
    const centerX = Math.floor(canvas.width / 2)
    const centerY = Math.floor(canvas.height / 2)
    for (const pixel of canvas.pixels.values()) {
      context.fillStyle = pixel.color
      context.fillRect(pixel.x + centerX, pixel.y + centerY, 1, 1)
    }
    if (preview) {
      context.save()
      context.globalAlpha = 0.55
      for (const pixel of preview.pixels) {
        context.fillStyle = pixel.color
        context.fillRect(pixel.x + preview.origin.x + centerX, pixel.y + preview.origin.y + centerY, 1, 1)
      }
      context.restore()
    }
  }, [canvas, preview])

  return (
    <figure className={styles.figure}>
      {canDraw ? (
        <>
          <div className={styles.controls} role="group" aria-label="Zoom de la toile">
            <button type="button" onClick={zoomOut} disabled={!canZoomOut}>Dézoomer</button>
            <button type="button" onClick={zoomIn} disabled={!canZoomIn}>Zoomer</button>
            <button type="button" onClick={reset}>Vue d’ensemble</button>
          </div>
          <p id={navigationId} className={styles.caption}>
            Zoomez à la molette ou en pinçant. Déplacez la toile en la faisant glisser ou avec les flèches du clavier.
          </p>
          <div
            {...viewportProps}
            className={styles.viewport}
            role="region"
            aria-label="Navigation sur la toile"
            aria-describedby={navigationId}
            tabIndex={0}
            style={{ aspectRatio: `${canvas.width} / ${canvas.height}` }}
          >
            <canvas
              ref={ref}
              width={canvas.width}
              height={canvas.height}
              className={onSelectCell ? `${styles.canvas} ${styles.selectable}` : styles.canvas}
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
      <figcaption id={captionId} className={styles.caption}>
        {count === 0 ? 'Aucun pixel posé.' : `${count} pixel${count > 1 ? 's' : ''} coloré${count > 1 ? 's' : ''}.`}
        {' '}Le damier représente les cases vides. L’origine (0, 0) est au centre.
      </figcaption>
      <details open={!canDraw || undefined} onToggle={(event) => setShowPixels(event.currentTarget.open || !canDraw)}>
        <summary>Consulter les pixels en texte</summary>
        {showPixels && (
          <ul className={styles.pixels} tabIndex={0} aria-label="Coordonnées et couleurs des pixels">
            {Array.from(canvas.pixels.values(), (pixel) => (
              <li key={`${pixel.x},${pixel.y}`}>({pixel.x}, {pixel.y}) : {pixel.color}</li>
            ))}
          </ul>
        )}
      </details>
    </figure>
  )
}
