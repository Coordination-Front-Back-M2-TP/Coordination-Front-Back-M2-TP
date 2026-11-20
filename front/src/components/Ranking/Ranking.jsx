import styles from './Ranking.module.css'

const MESSAGES = {
  loading: 'Chargement du classement…',
  live: 'Classement en direct',
  reconnecting: 'Classement en cours de synchronisation…',
  error: 'Classement indisponible',
}

// À l'écran : le rang, la couleur, le nom et le nombre de pixels, en colonnes.
// Pour un lecteur d'écran, chaque ligne se lit « Rang 1 — Rouge : 3 pixels ».
export function Ranking({ ranking, teams, status, onRetry }) {
  return (
    <section aria-labelledby="ranking-title" className={`hud ${styles.card}`}>
      <h2 id="ranking-title" className={styles.title}>Classement des équipes</h2>
      <p role="status" className={styles.status} data-status={status}>{MESSAGES[status]}</p>
      {status === 'error' && <div role="alert" className={styles.notice}>
        <p>Impossible de synchroniser le classement. Réessayez dans un instant.</p>
        <button type="button" className="secondary" onClick={onRetry}>Réessayer le classement</button>
      </div>}
      {ranking && status !== 'live' && <p className={styles.notice}>Dernier classement reçu affiché ; il peut avoir changé.</p>}
      {ranking && (ranking.teams.length === 0
        ? <p className={styles.empty}>Aucune équipe ne possède encore de pixel.</p>
        : <ol className={styles.list}>
          {ranking.teams.map(({ teamId, rank, pixelCount }) => {
            const team = teams.get(teamId)
            return <li key={teamId} className={styles.row}>
              <span className={styles.rank}><span className="visually-hidden">Rang </span>{rank}<span className="visually-hidden"> — </span></span>
              <span className={styles.swatch} style={team ? { backgroundColor: team.color } : undefined} aria-hidden="true" />
              <strong className={styles.name}>{team?.name ?? teamId}</strong>
              <span className="visually-hidden"> : </span>
              <span className={styles.count}>{pixelCount} {pixelCount === 1 ? 'pixel' : 'pixels'}</span>
            </li>
          })}
        </ol>)}
    </section>
  )
}
