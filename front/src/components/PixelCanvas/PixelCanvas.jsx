import { useEffect, useId, useRef, useState } from 'react'
import styles from './PixelCanvas.module.css'

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
  const captionId = useId()
  const [showPixels, setShowPixels] = useState(false)
  const [canDraw, setCanDraw] = useState(true)
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

  return (
    <figure className={styles.figure}>
      {canDraw ? (
        <canvas
          ref={ref}
          width={canvas.width}
          height={canvas.height}
          className={onSelectCell ? `${styles.canvas} ${styles.selectable}` : styles.canvas}
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
