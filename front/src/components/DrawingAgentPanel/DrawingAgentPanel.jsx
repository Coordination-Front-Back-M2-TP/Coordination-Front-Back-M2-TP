import { useId } from 'react'

export function DrawingAgentPanel({ control }) {
  const { agent, loaded, syncError, error, pending, refresh, start, stop } = control
  const titleId = useId()
  const formatId = useId()

  function importModel(event) {
    event.preventDefault()
    if (!loaded || pending || agent) return
    start(new FormData(event.currentTarget).get('model'))
  }

  return (
    <section aria-labelledby={titleId}>
      <h3 id={titleId}>Agent de dessin</h3>
      {!loaded && !syncError && <p role="status">Vérification de l’agent…</p>}
      {syncError && (
        <>
          <p role="status">Impossible d’actualiser la progression de l’agent.</p>
          <button type="button" disabled={pending} onClick={refresh}>Actualiser l’agent</button>
        </>
      )}
      {error && <p role="alert">{error}</p>}
      {agent ? (
        <>
          <label>
            Progression du modèle
            {' '}<progress value={agent.done} max={agent.total} />
          </label>
          <p>{agent.done} / {agent.total} pixels du modèle.</p>
          {agent.done === agent.total && <p>L’agent reste actif pour réparer les pixels écrasés.</p>}
          <button type="button" disabled={pending} onClick={stop}>Arrêter l’agent</button>
        </>
      ) : loaded && (
        <form onSubmit={importModel}>
          <label>
            Modèle placé (JSON)
            {' '}<input type="file" name="model" accept=".json,application/json" aria-describedby={formatId} required disabled={pending} />
          </label>
          <p id={formatId}>Chaque élément de la liste <code>pixels</code> contient <code>x</code>, <code>y</code> et <code>color</code> au format <code>#RRGGBB</code>.</p>
          <button type="submit" disabled={pending}>Lancer l’agent</button>
        </form>
      )}
    </section>
  )
}
