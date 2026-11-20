import { useEffect, useState } from 'react'
import { getHealth } from './api/health.js'
import { getCurrentUser } from './api/auth.js'
import { AccountBar } from './components/AccountBar/AccountBar.jsx'
import { AuthForm } from './components/AuthForm/AuthForm.jsx'
import { LiveCanvas } from './components/LiveCanvas/LiveCanvas.jsx'
import { TeamControls } from './components/TeamControls/TeamControls.jsx'
import { ServerStatus } from './components/ServerStatus/ServerStatus.jsx'

// Page de départ : elle montre si le front joint le back, ce qui valide l'installation (INSTALL.md, section 6).
function App() {
  const [backStatus, setBackStatus] = useState('vérification…')
  // undefined : session en cours de vérification ; null : visiteur ; objet : joueur connecté.
  const [user, setUser] = useState(undefined)
  const [sessionUnavailable, setSessionUnavailable] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    getHealth(controller.signal)
      .then(() => {
        if (!controller.signal.aborted) setBackStatus('ok')
      })
      .catch(() => {
        if (!controller.signal.aborted) setBackStatus('injoignable')
      })
    return () => controller.abort()
  }, [])

  // Au chargement, on retrouve la session : un rechargement de page garde le joueur connecté.
  useEffect(() => {
    const controller = new AbortController()
    getCurrentUser(controller.signal)
      .then((current) => {
        if (!controller.signal.aborted) setUser(current)
      })
      .catch(() => {
        if (controller.signal.aborted) return
        setSessionUnavailable(true)
        setUser(null)
      })
    return () => controller.abort()
  }, [])

  return (
    <main>
      {/* Le nom s'écrit en chiffres : sans aria-label, un lecteur d'écran l'épellerait. */}
      <h1 aria-label="Pixel">P1X3L</h1>
      <ServerStatus status={backStatus} />
      {backStatus === 'injoignable' && (
        <p role="alert">Impossible de vérifier la connexion au serveur. Rechargez la page pour réessayer.</p>
      )}
      {user === undefined && <p role="status">Vérification de la session…</p>}
      {user === null && sessionUnavailable && backStatus === 'ok' && (
        <p role="status">Session indisponible. Vous pouvez vous reconnecter ci-dessous.</p>
      )}
      {user === null && <AuthForm onAuthenticated={(current) => {
        setSessionUnavailable(false)
        setUser(current)
      }} />}
      {user && <AccountBar user={user} onLoggedOut={() => setUser(null)} />}
      {user && (
        <TeamControls
          key={user.pseudo}
          currentTeam={user.team}
          onTeamChanged={(team) => setUser((current) => (
            current === user ? { ...current, team } : current
          ))}
        />
      )}
      <LiveCanvas user={user ?? null} />
    </main>
  )
}

export default App
