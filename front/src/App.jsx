import { useEffect, useState } from 'react'
import { getHealth } from './api/health.js'
import { ServerStatus } from './components/ServerStatus.jsx'
import { LiveCanvas } from './components/LiveCanvas.jsx'
import { getCurrentUser } from './api/auth.js'
import { AuthForm } from './components/AuthForm.jsx'
import { AccountBar } from './components/AccountBar.jsx'

// Page de départ : elle montre si le front joint le back, ce qui valide l'installation (INSTALL.md, section 6).
function App() {
  const [backStatus, setBackStatus] = useState('vérification…')
  // undefined : session en cours de vérification ; null : visiteur ; objet : joueur connecté.
  const [user, setUser] = useState(undefined)

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
        if (!controller.signal.aborted) setUser(null)
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
      {user === null && <AuthForm onAuthenticated={setUser} />}
      {user && <AccountBar user={user} onLoggedOut={() => setUser(null)} />}
      <LiveCanvas />
    </main>
  )
}

export default App
