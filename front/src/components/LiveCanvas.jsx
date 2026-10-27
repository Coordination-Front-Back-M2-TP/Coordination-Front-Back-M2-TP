import { useEffect, useState } from 'react'
import { subscribeCanvas } from '../api/canvas.js'
import { PixelCanvas } from './PixelCanvas.jsx'

const STATUS_MESSAGES = {
  loading: 'Chargement de la toile…',
  live: 'Toile en direct',
  reconnecting: 'Connexion interrompue. Reconnexion en cours…',
  error: 'Toile indisponible',
}

export function LiveCanvas() {
  const [{ canvas, status }, setConnection] = useState({ canvas: null, status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => subscribeCanvas(setConnection), [attempt])

  return (
    <section aria-labelledby="canvas-title">
      <h2 id="canvas-title">La toile en direct</h2>
      <p role="status">{STATUS_MESSAGES[status]}</p>
      {status === 'error' && (
        <div role="alert">
          <p>Impossible de synchroniser la toile. Réessayez dans un instant.</p>
          <button type="button" onClick={() => setAttempt((value) => value + 1)}>Réessayer</button>
        </div>
      )}
      {canvas && status !== 'live' && <p>Dernier état reçu affiché ; les nouveaux pixels peuvent manquer.</p>}
      {canvas && <PixelCanvas canvas={canvas} />}
    </section>
  )
}
