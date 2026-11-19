// Affiche l'état de connexion au back-end (ok, vérification…, injoignable).
export function ServerStatus({ status = 'vérification…' }) {
  return <p role="status">Back : {status}</p>
}
