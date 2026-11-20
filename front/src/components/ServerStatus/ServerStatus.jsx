import styles from './ServerStatus.module.css'

const DOT_CLASSES = { ok: styles.ok, injoignable: styles.down }

// État de connexion au back-end (ok, vérification…, injoignable). Le joueur n'en voit qu'un point de couleur ;
// le texte reste lu par les lecteurs d'écran, et une panne s'affiche aussi en toutes lettres (App).
export function ServerStatus({ status = 'vérification…' }) {
  return (
    <p role="status" className={styles.status} title={`Serveur : ${status}`}>
      <span className={`${styles.dot} ${DOT_CLASSES[status] ?? ''}`} aria-hidden="true" />
      <span className="visually-hidden">Back : {status}</span>
    </p>
  )
}
