import { useEffect, useRef, useState } from 'react'
import { subscribeCanvas } from '../../api/canvas.js'
import { createRankingFeed } from '../../api/rankings.js'
import { PixelPlacer } from '../PixelPlacer/PixelPlacer.jsx'
import { Ranking } from '../Ranking/Ranking.jsx'
import { PlayerModeration } from '../PlayerModeration/PlayerModeration.jsx'

const STATUS_MESSAGES = {
  loading: 'Chargement de la toile…',
  live: 'Toile en direct',
  reconnecting: 'Connexion interrompue. Reconnexion en cours…',
  error: 'Toile indisponible',
}

// user est transmis au panneau de pose ; la consultation de la toile reste publique.
export function LiveCanvas({ user }) {
  const [{ canvas, status }, setConnection] = useState({ canvas: null, status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [rankingState, setRankingState] = useState({ ranking: null, teams: new Map(), status: 'loading' })
  const rankingFeed = useRef(null)

  useEffect(() => {
    const feed = createRankingFeed(setRankingState)
    rankingFeed.current = feed
    const stop = subscribeCanvas((state) => {
      setConnection(state)
      feed.setConnection(state.status)
    }, { onRanking: feed.receive })
    return () => { stop(); feed.stop() }
  }, [attempt])

  return (
    <section aria-labelledby="canvas-title">
      <h2 id="canvas-title">La toile en direct</h2>
      <p role="status">{STATUS_MESSAGES[status]}</p>
      {status === 'error' && (
        <div role="alert">
          <p>Impossible de synchroniser la toile. Réessayez dans un instant.</p>
          <button type="button" onClick={() => setAttempt((value) => value + 1)}>Réessayer</button>
        </div>
      )}
      {canvas && status !== 'live' && <p>Dernier état reçu affiché ; les nouveaux pixels peuvent manquer.</p>}
      {canvas && <PixelPlacer key={user ? 'account:' + user.pseudo : 'visitor'} canvas={canvas} user={user} />}
      <Ranking {...rankingState} onRetry={() => {
        if (!rankingFeed.current?.retry()) setAttempt((value) => value + 1)
      }} />
      {user?.role === 'admin' && <PlayerModeration key={user.pseudo} />}
    </section>
  )
}
