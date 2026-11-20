import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { HudPortal } from '../HudPortal/HudPortal.jsx'
import styles from './PixelCanvas.module.css'

// Zoom 1 : la toile entière tient à l'écran. Au-delà, elle déborde et la zone défile.
const ZOOM_MIN = 1
const ZOOM_MAX = 8
const ZOOM_STEP = 1.5

// Zoom de départ : la toile couvre tout l'écran, comme dans la maquette A.
function coverZoom() {
  if (typeof window === 'undefined' || !window.innerWidth || !window.innerHeight) return ZOOM_MIN
  const { innerWidth: width, innerHeight: height } = window
  return Math.min(ZOOM_MAX, Math.max(width, height) / Math.min(width, height))
}

// Traduit un clic en coordonnées de case, origine au centre. La bordure est retirée pour viser la bonne case.
function cellFromClick(event, { width, height }) {
  const element = event.currentTarget
  const rect = element.getBoundingClientRect()
  if (!element.clientWidth || !element.clientHeight) return null
  const column = Math.floor(((event.clientX - rect.left - element.clientLeft) / element.clientWidth) * width)
  const row = Math.floor(((event.clientY - rect.top - element.clientTop) / element.clientHeight) * height)
  if (column < 0 || column >= width || row < 0 || row >= height) return null
  return { x: column - Math.floor(width / 2), y: row - Math.floor(height / 2) }
}

// Sans onSelectCell, la toile reste en lecture seule : c'est le cas d'un visiteur sans compte.
export function PixelCanvas({ canvas, onSelectCell }) {
  const ref = useRef(null)
  const stageRef = useRef(null)
  // Point de la toile au centre de l'écran, en proportion : il reste au centre quand on zoome.
  const focus = useRef({ x: 0.5, y: 0.5 })
  const captionId = useId()
  const [showPixels, setShowPixels] = useState(false)
  const [canDraw, setCanDraw] = useState(true)
  const [zoom, setZoom] = useState(coverZoom)
  const count = canvas.pixels.size

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

  // Après chaque zoom, on ramène au centre de l'écran le point qui y était avant.
  useLayoutEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    stage.scrollLeft = focus.current.x * stage.scrollWidth - stage.clientWidth / 2
    stage.scrollTop = focus.current.y * stage.scrollHeight - stage.clientHeight / 2
  }, [zoom, canDraw])

  function changeZoom(next) {
    const stage = stageRef.current
    if (stage?.scrollWidth && stage.scrollHeight) {
      focus.current = {
        x: (stage.scrollLeft + stage.clientWidth / 2) / stage.scrollWidth,
        y: (stage.scrollTop + stage.clientHeight / 2) / stage.scrollHeight,
      }
    }
    setZoom(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next)))
  }

  return (
    <figure className={styles.figure}>
      {canDraw ? (
        <div ref={stageRef} className={styles.stage} tabIndex={0} role="region" aria-label="Zone de la toile, défilable">
          <canvas
            ref={ref}
            width={canvas.width}
            height={canvas.height}
            className={onSelectCell ? `${styles.canvas} ${styles.selectable}` : styles.canvas}
            style={{ '--zoom': zoom, '--cols': canvas.width, '--rows': canvas.height }}
            onClick={onSelectCell ? (event) => {
              const cell = cellFromClick(event, canvas)
              if (cell) onSelectCell(cell)
            } : undefined}
            role="img"
            aria-label={`Toile partagée de ${canvas.width} par ${canvas.height} pixels`}
            aria-describedby={captionId}
          >
            Les coordonnées et les couleurs sont disponibles dans la liste des pixels ci-dessous.
          </canvas>
        </div>
      ) : <p role="alert">L’affichage graphique est indisponible. Consultez les pixels en texte ci-dessous.</p>}
      <figcaption id={captionId} className="visually-hidden">
        {count === 0 ? 'Aucun pixel posé.' : `${count} pixel${count > 1 ? 's' : ''} coloré${count > 1 ? 's' : ''}.`}
        {' '}Le damier représente les cases vides. L’origine (0, 0) est au centre.
      </figcaption>
      <HudPortal>
        {canDraw && (
          <div className={`hud ${styles.zoom}`} role="group" aria-label="Zoom de la toile">
            <button type="button" className="secondary" onClick={() => changeZoom(zoom * ZOOM_STEP)} disabled={zoom >= ZOOM_MAX}
              aria-label="Zoomer">+</button>
            <button type="button" className="secondary" onClick={() => changeZoom(zoom / ZOOM_STEP)} disabled={zoom <= ZOOM_MIN}
              aria-label="Dézoomer">−</button>
            <button type="button" className="secondary" onClick={() => changeZoom(ZOOM_MIN)} disabled={zoom <= ZOOM_MIN}>
              Vue d’ensemble
            </button>
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
