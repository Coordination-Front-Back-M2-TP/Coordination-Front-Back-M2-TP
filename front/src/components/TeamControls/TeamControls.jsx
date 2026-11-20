import { useState } from 'react'
import { useCooldown } from '../../hooks/use-cooldown.js'
import { TeamCreationForm } from '../TeamCreationForm/TeamCreationForm.jsx'
import { TeamPicker } from '../TeamPicker/TeamPicker.jsx'

export function TeamControls({ currentTeam, onTeamChanged }) {
  const { seconds, startCooldown } = useCooldown()
  const [pending, setPending] = useState(null)
  const [listRevision, setListRevision] = useState(0)
  const coolingDown = seconds > 0
  const disabled = coolingDown || pending !== null

  function applyTeamChange(team, availableAt) {
    startCooldown(availableAt - Date.now())
    onTeamChanged(team)
  }

  return (
    <>
      <TeamPicker
        currentTeam={currentTeam}
        listRevision={listRevision}
        disabled={disabled}
        pending={pending === 'join'}
        onPendingChange={(active) => setPending(active ? 'join' : null)}
        onCooldown={startCooldown}
        onTeamJoined={applyTeamChange}
      />
      <TeamCreationForm
        disabled={disabled}
        pending={pending === 'create'}
        onPendingChange={(active) => setPending(active ? 'create' : null)}
        onCooldown={startCooldown}
        onTeamCreated={(team, availableAt) => {
          applyTeamChange(team, availableAt)
          setListRevision((revision) => revision + 1)
        }}
      />
      {coolingDown && <p role="timer">Prochain changement d’équipe dans {seconds} s.</p>}
    </>
  )
}
