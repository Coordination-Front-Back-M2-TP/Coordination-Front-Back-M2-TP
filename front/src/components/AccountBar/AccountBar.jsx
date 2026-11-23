import { useState } from 'react'
import { logout } from '../../api/auth.js'
import styles from './AccountBar.module.css'

// Joueur connecté : son pseudo et le bouton de déconnexion.
export function AccountBar({ user, onLoggedOut }) {
  const [error, setError] = useState(false)
  const [pending, setPending] = useState(false)

  async function handleLogout() {
    if (pending) return
    setPending(true)
    setError(false)
    try {
      await logout()
      onLoggedOut()
    } catch {
      setError(true)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className={styles.bar}>
      <p className={styles.who}>
        <span className="visually-hidden">Connecté en tant que </span><strong>{user.pseudo}</strong>
        {user.team && <span className={styles.team}> · Équipe {user.team.name}</span>}
      </p>
      <button type="button" className="secondary" disabled={pending} onClick={handleLogout}>{pending ? 'Déconnexion…' : 'Se déconnecter'}</button>
      {error && <p role="alert" className={styles.error}>La déconnexion a échoué. Réessayez.</p>}
    </div>
  )
}
