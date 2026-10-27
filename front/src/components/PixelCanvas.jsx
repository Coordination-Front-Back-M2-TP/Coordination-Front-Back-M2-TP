import { useEffect, useId, useRef, useState } from 'react'
import styles from './PixelCanvas.module.css'

export function PixelCanvas({ canvas }) {
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
          className={styles.canvas}
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
