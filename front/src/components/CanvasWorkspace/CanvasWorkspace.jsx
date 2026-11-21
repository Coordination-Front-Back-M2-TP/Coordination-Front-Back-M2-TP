import { useState } from 'react'
import { ModelRequest } from '../ModelRequest/ModelRequest.jsx'
import { PixelPlacer } from '../PixelPlacer/PixelPlacer.jsx'

const DIRECTIONS = [
  { label: 'Gauche', direction: 'la gauche', x: -1, y: 0 },
  { label: 'Droite', direction: 'la droite', x: 1, y: 0 },
  { label: 'Haut', direction: 'le haut', x: 0, y: -1 },
  { label: 'Bas', direction: 'le bas', x: 0, y: 1 },
]

function clampOrigin(origin, canvas, model) {
  const minX = -Math.floor(canvas.width / 2)
  const minY = -Math.floor(canvas.height / 2)
  return {
    x: Math.max(minX, Math.min(origin.x, minX + canvas.width - model.width)),
    y: Math.max(minY, Math.min(origin.y, minY + canvas.height - model.height)),
  }
}

export function CanvasWorkspace({ canvas, user }) {
  const [requestOpen, setRequestOpen] = useState(null)
  const [draft, setDraft] = useState(null)
  const fits = draft && draft.model.width <= canvas.width && draft.model.height <= canvas.height
  const origin = fits ? clampOrigin(draft.origin, canvas, draft.model) : null
  const moving = fits && !draft.confirmed

  function move(origin) {
    setDraft((current) => ({ ...current, origin: clampOrigin(origin, canvas, current.model) }))
  }

  return (
    <>
      {user && (
        <>
          <button type="button" aria-expanded={Boolean(requestOpen)} onClick={() => setRequestOpen((open) => !open)}>
            {requestOpen ? 'Fermer la génération' : 'Demander un modèle à l’IA'}
          </button>
          {requestOpen !== null && (
            <div hidden={!requestOpen}>
              <ModelRequest onModel={(model) => {
                const center = { x: -Math.floor(model.width / 2), y: -Math.floor(model.height / 2) }
                setDraft({ model, origin: center, confirmed: false })
              }} />
            </div>
          )}
        </>
      )}
      {draft && (
        <div role="group" aria-label="Placement du modèle">
          {!fits && <p role="alert">Ce modèle est trop grand pour la toile.</p>}
          {origin && <p role="status">Modèle {moving ? 'en aperçu' : 'placé'} en ({origin.x}, {origin.y}).</p>}
          {moving && DIRECTIONS.map(({ label, direction, x, y }) => {
            const target = clampOrigin({ x: origin.x + x, y: origin.y + y }, canvas, draft.model)
            return (
              <button key={label} type="button" aria-label={`Déplacer le modèle vers ${direction}`}
                disabled={target.x === origin.x && target.y === origin.y} onClick={() => move(target)}>
                {label}
              </button>
            )
          })}
          {moving && <button type="button" onClick={() => setDraft({ ...draft, origin, confirmed: true })}>Valider le placement</button>}
          {fits && !moving && <button type="button" onClick={() => setDraft({ ...draft, origin, confirmed: false })}>Déplacer le modèle</button>}
          <button type="button" onClick={() => setDraft(null)}>Retirer le modèle</button>
        </div>
      )}
      <PixelPlacer canvas={canvas} user={user}
        preview={origin ? { pixels: draft.model.pixels, origin } : null}
        onMovePreview={moving ? move : undefined} />
    </>
  )
}
