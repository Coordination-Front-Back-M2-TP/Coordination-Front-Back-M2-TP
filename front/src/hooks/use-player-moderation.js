import { useEffect, useRef, useState } from 'react'
import { banPlayer, listModerationPlayers } from '../api/player-moderation.js'

const ERRORS = new Map([
  ['UNAUTHORIZED', 'Reconnectez-vous avec un compte admin.'],
  ['FORBIDDEN', 'La modération est réservée aux comptes admin.'],
  ['PLAYER_NOT_FOUND', 'Ce joueur est introuvable. Actualisez la liste.'],
  ['ALREADY_BANNED', 'Ce joueur est déjà banni.'],
  ['ADMIN_NOT_BANNABLE', 'Un compte admin ne peut pas être banni.'],
])

export function usePlayerModeration() {
  const request = useRef(null)
  const [players, setPlayers] = useState(null)
  const [nextCursor, setNextCursor] = useState(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(null)
  const [receipt, setReceipt] = useState(null)

  useEffect(() => () => request.current?.abort(), [])

  async function run(action, message, handleRefusal) {
    if (request.current) return
    const controller = new AbortController()
    request.current = controller
    setPending(true)
    setError(null)
    try {
      await action(controller.signal)
    } catch (failure) {
      if (!controller.signal.aborted) {
        handleRefusal?.(failure?.code)
        setError(ERRORS.get(failure?.code) ?? message)
      }
    } finally {
      if (!controller.signal.aborted) {
        request.current = null
        setPending(false)
      }
    }
  }

  function load(after = null) {
    return run(async (signal) => {
      const page = await listModerationPlayers(after, signal)
      if (signal.aborted) return
      setPlayers((current) => after ? [...current, ...page.players] : page.players)
      setNextCursor(page.nextCursor)
    }, 'Impossible de charger les joueurs.')
  }

  function markBanned(pseudo) {
    setPlayers((current) => current.map((player) => player.pseudo === pseudo ? { ...player, banned: true } : player))
  }

  function ban(pseudo) {
    return run(async (signal) => {
      setReceipt(null)
      const result = await banPlayer(pseudo, signal)
      if (signal.aborted) return
      markBanned(pseudo)
      setReceipt(result)
    }, 'Impossible de confirmer le bannissement. Actualisez la liste avant de réessayer.', (code) => {
      if (code === 'ALREADY_BANNED') markBanned(pseudo)
    })
  }

  return { players, nextCursor, pending, error, receipt, load, ban }
}
