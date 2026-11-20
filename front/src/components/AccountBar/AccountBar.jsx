import { useState } from 'react'
import { logout } from '../../api/auth.js'

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
    <p>
      Connecté en tant que <strong>{user.pseudo}</strong>{' '}
      <button type="button" disabled={pending} onClick={handleLogout}>{pending ? 'Déconnexion…' : 'Se déconnecter'}</button>
      {error && <span role="alert"> La déconnexion a échoué. Réessayez.</span>}
    </p>
  )
}
