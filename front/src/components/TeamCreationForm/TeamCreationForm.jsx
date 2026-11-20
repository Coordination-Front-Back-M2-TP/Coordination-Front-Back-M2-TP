import { useId, useState } from 'react'
import { PALETTE } from '../../api/palette.js'
import { createTeam } from '../../api/teams.js'

const NAME_RULES = 'De 3 à 20 caractères : lettres, chiffres, espaces, tirets et tirets bas.'
const ERROR_MESSAGES = new Map([
  ['INVALID_INPUT', 'Vérifiez le nom et la couleur de l’équipe.'],
  ['UNAUTHORIZED', 'Votre session a expiré. Reconnectez-vous pour créer une équipe.'],
  ['ACCOUNT_BANNED', 'Votre compte est banni. Vous ne pouvez pas créer d’équipe.'],
  ['TEAM_NAME_TAKEN', 'Ce nom d’équipe est déjà utilisé. Choisissez-en un autre.'],
  ['TEAM_CHANGE_COOLDOWN', 'Le délai pour changer d’équipe est toujours en cours.'],
])

function isValidName(name) {
  const length = [...name].length
  return length >= 3 && length <= 20 && /^[\p{L}\p{N} _-]+$/u.test(name)
}

export function TeamCreationForm({ disabled, pending, onPendingChange, onCooldown, onTeamCreated }) {
  const nameHintId = useId()
  const [name, setName] = useState('')
  const [color, setColor] = useState('')
  const [error, setError] = useState(null)
  const [createdTeam, setCreatedTeam] = useState(null)

  async function handleSubmit(event) {
    event.preventDefault()
    if (disabled) return

    setError(null)
    setCreatedTeam(null)
    const trimmedName = name.trim().normalize()
    if (!isValidName(trimmedName)) {
      setError(`Le nom d’équipe est invalide. ${NAME_RULES}`)
      return
    }

    onPendingChange(true)
    try {
      const { team, availableAt } = await createTeam(trimmedName, color)
      onTeamCreated(team, availableAt)
      setCreatedTeam(team.name)
      setName('')
      setColor('')
    } catch (failure) {
      if (failure.code === 'TEAM_CHANGE_COOLDOWN' && failure.retryAfterMs > 0) {
        onCooldown(failure.retryAfterMs)
        return
      }
      setError(ERROR_MESSAGES.get(failure.code) ?? 'Impossible de créer l’équipe. Réessayez.')
    } finally {
      onPendingChange(false)
    }
  }

  return (
    <section>
      <h2>Créer une équipe</h2>
      <form onSubmit={handleSubmit}>
        <fieldset disabled={pending}>
          <legend>Nouvelle équipe</legend>
          <label>
            Nom de l’équipe
            <input value={name} onChange={(event) => setName(event.target.value)} aria-describedby={nameHintId} required />
          </label>
          <p id={nameHintId}>{NAME_RULES}</p>
          <label>
            Couleur de l’équipe
            <select value={color} onChange={(event) => setColor(event.target.value)} required>
              <option value="">Choisir une couleur</option>
              {PALETTE.map(({ color, name }) => <option key={color} value={color}>{name}</option>)}
            </select>
          </label>{' '}
          <button type="submit" disabled={disabled}>{pending ? 'Création…' : 'Créer l’équipe'}</button>
        </fieldset>
        {error && <p role="alert">{error}</p>}
        {createdTeam && <p role="status">Vous avez créé et rejoint l’équipe {createdTeam}.</p>}
      </form>
    </section>
  )
}
