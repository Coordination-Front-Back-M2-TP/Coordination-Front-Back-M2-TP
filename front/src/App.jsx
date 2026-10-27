import { useEffect, useState } from 'react'
import { getHealth } from './api/health.js'
import { ServerStatus } from './components/ServerStatus.jsx'
import { LiveCanvas } from './components/LiveCanvas.jsx'

// Page de départ : elle montre si le front joint le back, ce qui valide l'installation (INSTALL.md, section 6).
function App() {
  const [backStatus, setBackStatus] = useState('vérification…')

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

  return (
    <main>
      {/* Le nom s'écrit en chiffres : sans aria-label, un lecteur d'écran l'épellerait. */}
      <h1 aria-label="Pixel">P1X3L</h1>
      <ServerStatus status={backStatus} />
      {backStatus === 'injoignable' && (
        <p role="alert">Impossible de vérifier la connexion au serveur. Rechargez la page pour réessayer.</p>
      )}
      <LiveCanvas />
    </main>
  )
}

export default App
