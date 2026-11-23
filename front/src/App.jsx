import { useEffect, useId, useState } from 'react'
import { getHealth } from './api/health.js'
import { getCurrentUser } from './api/auth.js'
import { AccountBar } from './components/AccountBar/AccountBar.jsx'
import { AuthForm } from './components/AuthForm/AuthForm.jsx'
import { LiveCanvas } from './components/LiveCanvas/LiveCanvas.jsx'
import { TeamMembership } from './components/TeamMembership/TeamMembership.jsx'
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
  const [sideSlot, setSideSlot] = useState(null)
  // Sur téléphone, le compte, le classement et les réglages de la toile sont repliés derrière le bouton Menu.
  const [menuOpen, setMenuOpen] = useState(false)
  const menuId = useId()

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
      <div className={styles.top} data-open={menuOpen || undefined}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setMenuOpen(false)
        }}>
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
        <button type="button" className={`hud ${styles.menuButton}`} aria-expanded={menuOpen} aria-controls={menuId}
          onClick={() => setMenuOpen((open) => !open)}>
          {menuOpen ? 'Fermer' : user === null ? 'Connexion' : 'Menu'}
        </button>
        <div id={menuId} className={styles.side}>
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
            {/* Sans équipe, le choix est ouvert : il faut une équipe pour poser. Avec une équipe, il se replie
                pour laisser la toile visible, surtout sur téléphone. */}
            {user && (
              <details className={styles.teamDetails} open={!user.team || undefined}>
                <summary>{user.team ? 'Changer ou créer une équipe' : 'Rejoindre ou créer une équipe'}</summary>
                <div className={styles.teamPanel}>
                  <TeamMembership key={user.pseudo} user={user} onTeamChanged={setUser} />
                </div>
              </details>
            )}
          </div>
          <div ref={setSideSlot} className={styles.slot} />
        </div>
      </div>
      <HudSlotContext value={hudSlot || sideSlot ? { main: hudSlot, side: sideSlot } : null}>
        <LiveCanvas user={user ?? null} />
      </HudSlotContext>
    </main>
  )
}

export default App
