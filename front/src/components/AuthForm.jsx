import { useId, useState } from 'react'
import { AuthError, login, register } from '../api/auth.js'

// Messages fixes : le texte renvoyé par le serveur n'est jamais affiché tel quel.
const MESSAGES = {
  PSEUDO_TAKEN: 'Ce pseudo est déjà pris.',
  INVALID_CREDENTIALS: 'Pseudo ou mot de passe incorrect.',
  VALIDATION_ERROR: 'Pseudo ou mot de passe invalide.',
}
const DEFAULT_MESSAGE = "L'opération a échoué. Réessayez dans un instant."

// Inscription ou connexion sur un seul écran : deux champs, un bouton.
export function AuthForm({ onAuthenticated }) {
  const [mode, setMode] = useState('login')
  const [pseudo, setPseudo] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [pending, setPending] = useState(false)
  const id = useId()
  const isRegister = mode === 'register'

  async function handleSubmit(event) {
    event.preventDefault()
    setPending(true)
    setError(null)
    try {
      const user = await (isRegister ? register : login)(pseudo.trim(), password)
      setPassword('')
      onAuthenticated(user)
    } catch (e) {
      setError(MESSAGES[e instanceof AuthError ? e.code : ''] ?? DEFAULT_MESSAGE)
    } finally {
      setPending(false)
    }
  }

  function switchMode() {
    setMode(isRegister ? 'login' : 'register')
    setError(null)
  }

  return (
    <form onSubmit={handleSubmit} aria-labelledby={`${id}-titre`}>
      <h2 id={`${id}-titre`}>{isRegister ? 'Créer un compte' : 'Se connecter'}</h2>
      <p>
        <label htmlFor={`${id}-pseudo`}>Pseudo</label>{' '}
        <input id={`${id}-pseudo`} name="pseudo" autoComplete="username" required value={pseudo}
          onChange={(e) => setPseudo(e.target.value)} />
      </p>
      <p>
        <label htmlFor={`${id}-mdp`}>Mot de passe</label>{' '}
        <input id={`${id}-mdp`} name="password" type="password" required value={password}
          autoComplete={isRegister ? 'new-password' : 'current-password'}
          onChange={(e) => setPassword(e.target.value)} />
      </p>
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={pending}>{isRegister ? "S'inscrire" : 'Se connecter'}</button>{' '}
      <button type="button" onClick={switchMode}>
        {isRegister ? 'J’ai déjà un compte' : 'Créer un compte'}
      </button>
    </form>
  )
}
