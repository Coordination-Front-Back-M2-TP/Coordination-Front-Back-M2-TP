import { useEffect, useRef, useState } from 'react'
import { joinTeam, listTeams } from '../../api/team-membership.js'

const ERROR_MESSAGES = {
  TEAM_CHANGE_COOLDOWN: 'Attendez la fin du délai avant de changer d’équipe.',
  TEAM_NOT_FOUND: 'Cette équipe est indisponible. Choisissez-en une autre.',
  UNAUTHORIZED: 'Reconnectez-vous pour choisir une équipe.',
}

export function TeamPicker({ currentTeam, listRevision, disabled, pending, onPendingChange, onCooldown, onTeamJoined }) {
  const [teams, setTeams] = useState(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [selection, setSelection] = useState('')
  const [error, setError] = useState(null)
  const submission = useRef(null)
  const teamId = selection === currentTeam?.id ? '' : selection

  useEffect(() => {
    const controller = new AbortController()
    listTeams(controller.signal).then((result) => {
      if (controller.signal.aborted) return
      setTeams(result)
      setLoadFailed(false)
    }).catch(() => {
      if (!controller.signal.aborted) setLoadFailed(true)
    })
    return () => controller.abort()
  }, [attempt, listRevision])

  useEffect(() => () => submission.current?.abort(), [])

  async function handleSubmit(event) {
    event.preventDefault()
    if (disabled || !teamId || submission.current) return
    const controller = new AbortController()
    submission.current = controller
    onPendingChange(true)
    setError(null)
    try {
      const { user, availableAt } = await joinTeam(teamId, controller.signal)
      if (controller.signal.aborted) return
      setSelection('')
      onTeamJoined(user.team, availableAt)
    } catch (failure) {
      if (controller.signal.aborted) return
      if (failure.code === 'TEAM_CHANGE_COOLDOWN' && failure.retryAfterMs) {
        onCooldown(failure.retryAfterMs)
      } else {
        const message = Object.hasOwn(ERROR_MESSAGES, failure.code)
          ? ERROR_MESSAGES[failure.code]
          : 'Impossible de choisir cette équipe. Réessayez.'
        setError(message)
      }
    } finally {
      if (!controller.signal.aborted) {
        submission.current = null
        onPendingChange(false)
      }
    }
  }

  if (loadFailed) {
    return (
      <div>
        <p role="alert">Impossible de charger les équipes.</p>
        <button type="button" onClick={() => {
          setLoadFailed(false)
          setAttempt((value) => value + 1)
        }}>Réessayer de charger les équipes</button>
      </div>
    )
  }
  if (!teams) return <p role="status">Chargement des équipes…</p>
  const availableTeams = teams.filter((team) => team.id !== currentTeam?.id)
  if (availableTeams.length === 0) {
    return currentTeam ? null : <p>Aucune équipe disponible.</p>
  }

  return (
    <form onSubmit={handleSubmit}>
      <label>
        Équipe à rejoindre
        <select value={teamId} onChange={(event) => setSelection(event.target.value)} disabled={disabled}>
          <option value="">Sélectionnez une équipe</option>
          {availableTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
        </select>
      </label>
      <button type="submit" disabled={disabled || !teamId}>
        {pending ? 'Choix en cours…' : currentTeam ? 'Changer d’équipe' : 'Rejoindre l’équipe'}
      </button>
      {error && <p role="alert">{error}</p>}
    </form>
  )
}
