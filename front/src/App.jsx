import { useEffect, useState } from 'react'
import { getHealth } from './api/health.js'

// Page de départ : elle montre si le front joint le back, ce qui valide l'installation (INSTALL.md, section 6).
function App() {
  const [backStatus, setBackStatus] = useState('vérification…')

  useEffect(() => {
    const controller = new AbortController()
    getHealth(controller.signal)
      .then(() => setBackStatus('ok'))
      .catch((error) => {
        if (error.name !== 'AbortError') setBackStatus('injoignable')
      })
    return () => controller.abort()
  }, [])

  return (
    <main>
      {/* Le nom s'écrit en chiffres : sans aria-label, un lecteur d'écran l'épellerait. */}
      <h1 aria-label="Pixel">P1X3L</h1>
      <p role="status">Back : {backStatus}</p>
    </main>
  )
}

export default App
