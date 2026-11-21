import { useEffect, useRef, useState } from 'react'
import { cleanZone } from '../../api/moderation.js'
import styles from './ZoneCleanup.module.css'

const INVALID_ZONE = 'La zone doit être comprise dans la toile, du coin supérieur gauche au coin inférieur droit.'
const ERRORS = new Map([
  ['INVALID_INPUT', INVALID_ZONE],
  ['UNAUTHORIZED', 'Reconnectez-vous avec un compte admin.'],
  ['FORBIDDEN', 'Le nettoyage est réservé aux comptes admin.'],
])

function readZone(form) {
  const values = new FormData(form)
  const zone = Object.fromEntries(['fromX', 'fromY', 'toX', 'toY'].map((name) => [name, Number(values.get(name))]))
  return zone.fromX <= zone.toX && zone.fromY <= zone.toY ? zone : null
}

export function ZoneCleanup({ width, height, live }) {
  const request = useRef(null)
  const [zone, setZone] = useState(null)
  const [pending, setPending] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const minX = -Math.floor(width / 2)
  const minY = -Math.floor(height / 2)
  const maxX = minX + width - 1
  const maxY = minY + height - 1

  useEffect(() => () => request.current?.abort(), [])

  function prepare(event) {
    event.preventDefault()
    if (!live || request.current) return
    const selection = readZone(event.currentTarget)
    setZone(selection)
    setFeedback(selection ? null : { error: INVALID_ZONE })
  }

  async function confirm() {
    if (!live || !zone || request.current) return
    const controller = new AbortController()
    request.current = controller
    setPending(true)
    setZone(null)
    try {
      const receipt = await cleanZone(zone, controller.signal)
      if (!controller.signal.aborted) setFeedback({ receipt })
    } catch (error) {
      if (!controller.signal.aborted) {
        setFeedback({ error: ERRORS.get(error?.code) ?? 'Impossible de confirmer le nettoyage. Vérifiez la toile avant de réessayer.' })
      }
    } finally {
      if (!controller.signal.aborted) {
        request.current = null
        setPending(false)
      }
    }
  }

  return (
    <details>
      <summary>Nettoyer une zone</summary>
      <form aria-label="Délimiter la zone à nettoyer" onSubmit={prepare} onChange={() => setZone(null)}>
        {[
          { name: 'from', label: 'Coin supérieur gauche' },
          { name: 'to', label: 'Coin inférieur droit' },
        ].map(({ name, label }) => (
          <fieldset key={name} disabled={!live || pending} className={styles.corner}>
            <legend>{label}</legend>
            <label>X <input name={name + 'X'} type="number" min={minX} max={maxX} step="1" required /></label>
            <label>Y <input name={name + 'Y'} type="number" min={minY} max={maxY} step="1" required /></label>
          </fieldset>
        ))}
        <button type="submit" disabled={!live || pending}>Vérifier la zone</button>
      </form>
      {zone && (
        <div>
          <p role="status">Zone à vider de ({zone.fromX}, {zone.fromY}) à ({zone.toX}, {zone.toY}), coins inclus.</p>
          <button type="button" onClick={confirm} disabled={!live}>Confirmer le nettoyage</button>{' '}
          <button type="button" onClick={() => setZone(null)}>Annuler</button>
        </div>
      )}
      {pending && <p role="status">Nettoyage en cours…</p>}
      {feedback?.error && <p role="alert">{feedback.error}</p>}
      {feedback?.receipt && (
        <p role="status">
          Pixels retirés&nbsp;: {feedback.receipt.removedCount}. Action n° {feedback.receipt.id} inscrite au journal.
        </p>
      )}
    </details>
  )
}
