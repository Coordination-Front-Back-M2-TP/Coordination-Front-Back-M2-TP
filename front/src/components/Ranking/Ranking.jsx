import styles from './Ranking.module.css'

const MESSAGES = {
  loading: 'Chargement du classement…',
  live: 'Classement en direct',
  reconnecting: 'Classement en cours de synchronisation…',
  error: 'Classement indisponible',
}

export function Ranking({ ranking, teams, status, onRetry }) {
  return (
    <section aria-labelledby="ranking-title">
      <h2 id="ranking-title">Classement des équipes</h2>
      <p role="status">{MESSAGES[status]}</p>
      {status === 'error' && <div role="alert">
        <p>Impossible de synchroniser le classement. Réessayez dans un instant.</p>
        <button type="button" onClick={onRetry}>Réessayer le classement</button>
      </div>}
      {ranking && status !== 'live' && <p>Dernier classement reçu affiché ; il peut avoir changé.</p>}
      {ranking && (ranking.teams.length === 0
        ? <p>Aucune équipe ne possède encore de pixel.</p>
        : <ol className={styles.list}>
          {ranking.teams.map(({ teamId, rank, pixelCount }) => {
            const team = teams.get(teamId)
            return <li key={teamId}>
              <span>Rang {rank} — </span>
              {team && <span className={styles.swatch} style={{ backgroundColor: team.color }} aria-hidden="true" />}
              <strong>{team?.name ?? teamId}</strong> : {pixelCount} {pixelCount === 1 ? 'pixel' : 'pixels'}
            </li>
          })}
        </ol>)}
    </section>
  )
}
