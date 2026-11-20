import { useEffect, useState } from 'react'
import { getHealth } from './api/health.js'
import { getCurrentUser } from './api/auth.js'
import { AccountBar } from './components/AccountBar/AccountBar.jsx'
import { AuthForm } from './components/AuthForm/AuthForm.jsx'
import { LiveCanvas } from './components/LiveCanvas/LiveCanvas.jsx'
import { TeamPicker } from './components/TeamPicker/TeamPicker.jsx'
import { TeamCreation } from './components/TeamCreation/TeamCreation.jsx'
import { ServerStatus } from './components/ServerStatus/ServerStatus.jsx'
import { HudSlotContext } from './components/HudPortal/hud-slot.js'
import styles from './App.module.css'

// Page de départ : elle montre si le front joint le back, ce qui valide l'installation (INSTALL.md, section 6).
function App() {
  const [backStatus, setBackStatus] = useState('vérification…')
  // undefined : session en cours de vérification ; null : visiteur ; objet : joueur connecté.
  const [user, setUser] = useState(undefined)
  const [sessionUnavailable, setSessionUnavailable] = useState(false)
  // Élément de la colonne du HUD où LiveCanvas range ses messages (voir HudPortal).
  const [hudSlot, setHudSlot] = useState(null)

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

  // La toile couvre l'écran ; le HUD (logo, compte, messages, dock) flotte par-dessus.
  return (
    <main className={styles.app}>
      <div className={styles.top}>
        <div className={styles.column}>
          <header className={`hud ${styles.brand}`}>
            {/* Le nom s'écrit en chiffres : sans aria-label, un lecteur d'écran l'épellerait. */}
            <h1 aria-label="Pixel" className={styles.logo}>P1X3L</h1>
            <ServerStatus status={backStatus} />
          </header>
          {backStatus === 'injoignable' && (
            <p role="alert" className={`hud ${styles.notice}`}>
              Impossible de vérifier la connexion au serveur. Rechargez la page pour réessayer.
            </p>
          )}
          <div ref={setHudSlot} className={styles.slot} />
        </div>
        <div className={`hud ${styles.account}`}>
          {user === undefined && <p role="status">Vérification de la session…</p>}
          {user === null && sessionUnavailable && backStatus === 'ok' && (
            <p role="status">Session indisponible. Vous pouvez vous reconnecter ci-dessous.</p>
          )}
          {user === null && <AuthForm onAuthenticated={(current) => {
            setSessionUnavailable(false)
            setUser(current)
          }} />}
          {user && <AccountBar user={user} onLoggedOut={() => setUser(null)} />}
          {/* Sans équipe, le choix reste visible : il faut une équipe pour poser. Avec une équipe, le choix et
              la création se replient pour laisser la toile visible, surtout sur téléphone. */}
          {user && !user.team && <TeamPicker key={`${user.pseudo}:`} currentTeam={user.team} onTeamJoined={setUser} />}
          {user && !user.team && (
            <details className={styles.teamDetails}>
              <summary>Créer une équipe</summary>
              <TeamCreation key={user.pseudo} onCreated={({ user: current }) => setUser(current)} />
            </details>
          )}
          {user?.team && (
            <details className={styles.teamDetails}>
              <summary>Changer ou créer une équipe</summary>
              <div className={styles.teamPanel}>
                <TeamPicker key={`${user.pseudo}:${user.team.id}`} currentTeam={user.team} onTeamJoined={setUser} />
                <TeamCreation key={user.pseudo} onCreated={({ user: current }) => setUser(current)} />
              </div>
            </details>
          )}
        </div>
      </div>
      <HudSlotContext value={hudSlot}>
        <LiveCanvas user={user ?? null} />
      </HudSlotContext>
    </main>
  )
}

export default App
