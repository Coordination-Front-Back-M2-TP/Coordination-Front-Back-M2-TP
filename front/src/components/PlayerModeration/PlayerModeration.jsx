import { useState } from 'react'
import { usePlayerModeration } from '../../hooks/use-player-moderation.js'

export function PlayerModeration() {
  const { players, nextCursor, pending, error, receipt, load, ban } = usePlayerModeration()
  const [selected, setSelected] = useState(null)

  function open(event) {
    if (event.currentTarget.open && players === null && !pending && !error) load()
  }

  function reload() {
    setSelected(null)
    load()
  }

  function confirm() {
    if (!selected || pending) return
    ban(selected)
    setSelected(null)
  }

  return (
    <details onToggle={open}>
      <summary>Modérer les joueurs</summary>
      {pending && <p role="status">Opération en cours…</p>}
      {error && <p role="alert">{error}</p>}
      {receipt && (
        <p role="status">
          {receipt.pseudo} a été banni. Pixels restaurés&nbsp;: {receipt.restoredCount}.
          {' '}Cases vidées&nbsp;: {receipt.clearedCount}. Action n° {receipt.id} inscrite au journal.
        </p>
      )}
      {players?.length === 0 && <p>Aucun joueur.</p>}
      {players?.length > 0 && (
        <ul aria-label="Joueurs">
          {players.map(({ pseudo, role, banned }) => (
            <li key={pseudo}>
              {pseudo}{' '}
              {role === 'admin' && <span>· Admin</span>}
              {banned && <span>· Banni</span>}
              {role === 'player' && !banned && (
                <button type="button" disabled={pending} onClick={() => setSelected(pseudo)}>Bannir {pseudo}</button>
              )}
              {selected === pseudo && !banned && (
                <div>
                  <p role="status">Bannir {pseudo} et annuler ses pixels encore visibles sur la toile&nbsp;?</p>
                  <button type="button" disabled={pending} onClick={confirm}>Confirmer le bannissement</button>{' '}
                  <button type="button" onClick={() => setSelected(null)}>Annuler</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {nextCursor && <button type="button" disabled={pending} onClick={() => load(nextCursor)}>Charger la suite</button>}{' '}
      {(players || error) && <button type="button" disabled={pending} onClick={reload}>Actualiser les joueurs</button>}
    </details>
  )
}
