import { useCooldown } from '../../hooks/use-cooldown.js'
import { TeamCreation } from '../TeamCreation/TeamCreation.jsx'
import { TeamPicker } from '../TeamPicker/TeamPicker.jsx'

export function TeamMembership({ user, onTeamChanged }) {
  const { seconds, startCooldown } = useCooldown()
  const cooldownActive = seconds > 0

  function handleChange({ user: current, cooldownMs }) {
    startCooldown(cooldownMs)
    onTeamChanged(current)
  }

  return (
    <>
      {cooldownActive && <p role="timer">Changement d’équipe possible dans {seconds} s.</p>}
      <TeamPicker
        key={user.team?.id ?? ''}
        currentTeam={user.team}
        cooldownActive={cooldownActive}
        onCooldown={startCooldown}
        onTeamJoined={handleChange}
      />
      <TeamCreation cooldownActive={cooldownActive} onCooldown={startCooldown} onCreated={handleChange} />
    </>
  )
}
