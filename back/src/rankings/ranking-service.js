// Classe les équipes par nombre de pixels, du plus grand au plus petit.
// Deux équipes à égalité ont le même rang, et le rang suivant est sauté (1, 1, 3).
// À égalité, l'ordre suit l'identifiant de l'équipe, pour que la liste ne bouge pas d'une lecture à l'autre.
export function rankTeams(counts) {
  const sorted = [...counts].sort(
    (a, b) => b.pixelCount - a.pixelCount || (a.teamId < b.teamId ? -1 : a.teamId > b.teamId ? 1 : 0),
  )
  let rank = 0
  return sorted.map((team, index) => {
    if (index === 0 || team.pixelCount < sorted[index - 1].pixelCount) rank = index + 1
    return { teamId: team.teamId, pixelCount: team.pixelCount, rank }
  })
}

export function createRankingService({ repository }) {
  return {
    // revision : révision de la toile au moment du calcul. Elle permet d'ignorer un classement plus ancien.
    async getRanking() {
      const { revision, counts } = await repository.countPixelsByTeam()
      return { revision, teams: rankTeams(counts) }
    },
  }
}
