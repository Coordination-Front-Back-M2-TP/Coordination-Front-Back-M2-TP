import { useEffect, useRef, useState } from 'react'
import { joinTeam, listTeams } from '../../api/team-membership.js'
import styles from './TeamPicker.module.css'

const ERROR_MESSAGES = {
  TEAM_CHANGE_COOLDOWN: 'Attendez la fin du délai avant de changer d’équipe.',
  TEAM_NOT_FOUND: 'Cette équipe est indisponible. Choisissez-en une autre.',
  UNAUTHORIZED: 'Reconnectez-vous pour choisir une équipe.',
}

export function TeamPicker({ currentTeam, cooldownActive = false, onCooldown, onTeamJoined }) {
  const [teams, setTeams] = useState(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [selection, setSelection] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(null)
  const submission = useRef(null)
  const disabled = pending || cooldownActive
  const teamId = selection === currentTeam?.id ? '' : selection

  useEffect(() => {
    const controller = new AbortController()
    listTeams(controller.signal).then((result) => {
      if (!controller.signal.aborted) setTeams(result)
    }).catch(() => {
      if (!controller.signal.aborted) setLoadFailed(true)
    })
    return () => controller.abort()
  }, [attempt])

  useEffect(() => () => submission.current?.abort(), [])

  async function handleSubmit(event) {
    event.preventDefault()
    if (disabled || !teamId || submission.current) return
    const controller = new AbortController()
    submission.current = controller
    setPending(true)
    setError(null)
    try {
      const result = await joinTeam(teamId, controller.signal)
      if (controller.signal.aborted) return
      setSelection('')
      onTeamJoined(result)
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
        setPending(false)
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
  const displayedTeams = currentTeam && !teams.some((team) => team.id === currentTeam.id)
    ? [...teams, currentTeam]
    : teams
  if (displayedTeams.length === 0) return <p>Aucune équipe disponible.</p>

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <label className={styles.field}>
        Équipe à rejoindre
        <select value={teamId} onChange={(event) => setSelection(event.target.value)} disabled={disabled}>
          <option value="">Sélectionnez une équipe</option>
          {displayedTeams.map((team) => <option key={team.id} value={team.id} disabled={team.id === currentTeam?.id}>
            {team.name}{team.id === currentTeam?.id ? ' (équipe actuelle)' : ''}
          </option>)}
        </select>
      </label>
      <button type="submit" disabled={disabled || !teamId}>
        {pending ? 'Choix en cours…' : currentTeam ? 'Changer d’équipe' : 'Rejoindre l’équipe'}
      </button>
      <button type="button" className="secondary" disabled={pending} onClick={() => setAttempt((value) => value + 1)}>
        Actualiser les équipes
      </button>
      {error && <p role="alert" className={styles.note}>{error}</p>}
    </form>
  )
}
