// Les 4 équipes du jeu. Proposition retenue pour livrer la tâche #41 : les noms et les couleurs
// restent à valider par l'équipe. id est écrit dans les comptes et dans l'historique des poses :
// le changer demande une migration.
export const TEAMS = Object.freeze([
  Object.freeze({ id: 'rouge', name: 'Rouge', color: '#D93A3A' }),
  Object.freeze({ id: 'bleue', name: 'Bleue', color: '#2F6FDE' }),
  Object.freeze({ id: 'verte', name: 'Verte', color: '#2E9E4F' }),
  Object.freeze({ id: 'jaune', name: 'Jaune', color: '#E5B700' }),
])

// Renvoie l'équipe { id, name, color }, ou null si aucune n'a cet identifiant.
export function findTeam(teamId) {
  return TEAMS.find((team) => team.id === teamId) ?? null
}
