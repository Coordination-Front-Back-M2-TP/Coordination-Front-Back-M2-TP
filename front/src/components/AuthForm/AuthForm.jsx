import { useId, useState } from 'react'
import { AuthError, login, register } from '../../api/auth.js'
import styles from './AuthForm.module.css'

// Messages fixes : le texte renvoyé par le serveur n'est jamais affiché tel quel.
const MESSAGES = {
  PSEUDO_TAKEN: 'Ce pseudo est déjà pris.',
  INVALID_CREDENTIALS: 'Pseudo ou mot de passe incorrect.',
  INVALID_INPUT: 'Utilisez un pseudo de 3 à 20 caractères (lettres sans accent, chiffres, _ ou -) et un mot de passe de 8 à 128 caractères.',
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
    if (pending) return
    setPending(true)
    setError(null)
    try {
      const user = await (isRegister ? register : login)(pseudo.trim(), password)
      setPassword('')
      onAuthenticated(user)
    } catch (e) {
      const code = e instanceof AuthError ? e.code : null
      setError(Object.hasOwn(MESSAGES, code) ? MESSAGES[code] : DEFAULT_MESSAGE)
    } finally {
      setPending(false)
    }
  }

  function switchMode() {
    setMode(isRegister ? 'login' : 'register')
    setPassword('')
    setError(null)
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} aria-labelledby={`${id}-titre`}>
      <h2 id={`${id}-titre`} className={styles.title}>{isRegister ? 'Créer un compte' : 'Se connecter'}</h2>
      <p className={styles.field}>
        <label htmlFor={`${id}-pseudo`}>Pseudo</label>
        <input id={`${id}-pseudo`} name="pseudo" autoComplete="username" required disabled={pending} value={pseudo}
          onChange={(e) => setPseudo(e.target.value)} />
      </p>
      <p className={styles.field}>
        <label htmlFor={`${id}-mdp`}>Mot de passe</label>
        <input id={`${id}-mdp`} name="password" type="password" required disabled={pending} value={password}
          autoComplete={isRegister ? 'new-password' : 'current-password'}
          onChange={(e) => setPassword(e.target.value)} />
      </p>
      {error && <p role="alert">{error}</p>}
      <div className={styles.actions}>
        <button type="submit" disabled={pending}>{isRegister ? "S'inscrire" : 'Se connecter'}</button>
        <button type="button" className="secondary" disabled={pending} onClick={switchMode}>
          {isRegister ? 'J’ai déjà un compte' : 'Créer un compte'}
        </button>
      </div>
    </form>
  )
}
