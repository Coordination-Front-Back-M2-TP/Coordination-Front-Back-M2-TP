import { useEffect, useRef, useState } from 'react'
import { PALETTE } from '../../api/palette.js'
import { createTeam } from '../../api/team-membership.js'
import { useCooldown } from '../../hooks/use-cooldown.js'

const MESSAGES = {
  INVALID_INPUT: 'Utilisez un nom de 3 à 20 caractères : lettres, chiffres, espaces, _ ou -.',
  TEAM_NAME_TAKEN: 'Ce nom d’équipe est déjà pris.',
  UNAUTHORIZED: 'Reconnectez-vous pour créer une équipe.',
  ACCOUNT_BANNED: 'Votre compte ne peut pas créer d’équipe.',
  TEAM_CHANGE_COOLDOWN: 'Attendez avant de changer à nouveau d’équipe.',
}

export function TeamCreation({ onCreated }) {
  const [name, setName] = useState('')
  const [color, setColor] = useState('')
  const [error, setError] = useState(null)
  const [pending, setPending] = useState(false)
  const request = useRef(null)
  const { seconds, startCooldown } = useCooldown()
  const disabled = pending || seconds > 0

  useEffect(() => () => request.current?.abort(), [])

  async function handleSubmit(event) {
    event.preventDefault()
    if (disabled || request.current) return
    const trimmed = name.trim()
    if ([...trimmed].length < 3 || [...trimmed].length > 20 || !/^[\p{L}\p{M}\p{N} _-]+$/u.test(trimmed)) {
      setError(MESSAGES.INVALID_INPUT)
      return
    }
    if (!PALETTE.some((entry) => entry.color === color)) {
      setError('Choisissez une couleur dans la palette.')
      return
    }
    const controller = new AbortController()
    request.current = controller
    setPending(true)
    setError(null)
    try {
      const result = await createTeam(trimmed, color, controller.signal)
      if (controller.signal.aborted) return
      setName('')
      setColor('')
      onCreated(result)
    } catch (failure) {
      if (controller.signal.aborted) return
      if (failure.code === 'TEAM_CHANGE_COOLDOWN' && failure.retryAfterMs) startCooldown(failure.retryAfterMs)
      else setError(Object.hasOwn(MESSAGES, failure.code) ? MESSAGES[failure.code] : 'Impossible de créer cette équipe. Réessayez.')
    } finally {
      if (!controller.signal.aborted) {
        request.current = null
        setPending(false)
      }
    }
  }

  return (
    <form onSubmit={handleSubmit} aria-labelledby="create-team-title">
      <h2 id="create-team-title">Créer une équipe</h2>
      <p>Créer une équipe vous y fait entrer et applique le délai de changement d’équipe.</p>
      <p>
        <label htmlFor="team-name">Nom de l’équipe</label>{' '}
        <input id="team-name" value={name} onChange={(event) => setName(event.target.value)} required disabled={disabled} />
      </p>
      <p>
        <label htmlFor="team-color">Couleur de l’équipe</label>{' '}
        <select id="team-color" value={color} onChange={(event) => setColor(event.target.value)} required disabled={disabled}>
          <option value="">Sélectionnez une couleur</option>
          {PALETTE.map((entry) => <option key={entry.color} value={entry.color}>{entry.name}</option>)}
        </select>
      </p>
      {error && <p role="alert">{error}</p>}
      {seconds > 0 && <p role="timer">Création possible dans {seconds} s.</p>}
      <button type="submit" disabled={disabled}>{pending ? 'Création en cours…' : 'Créer l’équipe'}</button>
    </form>
  )
}
