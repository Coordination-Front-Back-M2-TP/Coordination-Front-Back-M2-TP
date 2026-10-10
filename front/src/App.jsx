import { useEffect, useState } from 'react'

// Page de départ : elle montre si le front joint le back, ce qui valide l'installation (INSTALL.md, section 6).
function App() {
  const [backStatus, setBackStatus] = useState('vérification…')

  useEffect(() => {
    fetch('/api/health')
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(response.statusText))))
      .then((body) => setBackStatus(body.status))
      .catch(() => setBackStatus('injoignable'))
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
