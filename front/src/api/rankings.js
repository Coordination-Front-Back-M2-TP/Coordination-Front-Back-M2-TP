async function readJson(url, signal) {
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error('Réponse invalide')
  return response.json()
}

function parseRanking(value) {
  if (!value || !Number.isSafeInteger(value.revision) || value.revision < 0 || !Array.isArray(value.teams)
    || value.teams.some((team) => !team || typeof team.teamId !== 'string' || !team.teamId
      || !Number.isSafeInteger(team.pixelCount) || team.pixelCount < 1
      || !Number.isSafeInteger(team.rank) || team.rank < 1)) throw new Error('Classement invalide')
  return value
}

function parseTeams(value) {
  if (!Array.isArray(value?.teams) || value.teams.some((team) => !team || typeof team.id !== 'string'
    || !team.id || typeof team.name !== 'string' || !team.name || !/^#[0-9a-f]{6}$/i.test(team.color))) {
    throw new Error('Équipes invalides')
  }
  return new Map(value.teams.map((team) => [team.id, team]))
}

export function createRankingFeed(onChange) {
  let ranking = null
  let teams = new Map()
  let status = 'loading'
  let connected = false
  let generation = 0
  let controller = null
  let teamsRequest = null

  function publish() {
    onChange({ ranking, teams, status })
  }

  function fail() {
    status = 'error'
    publish()
  }

  function refreshTeams(request) {
    if (teamsRequest) return teamsRequest
    const current = controller
    const requestedIds = new Set(ranking.teams.map((team) => team.teamId))
    const pending = readJson('/api/teams', current.signal).then((value) => {
      if (request !== generation) return
      teams = parseTeams(value)
      publish()
    }).catch(() => {
      if (request === generation) fail()
    }).finally(() => {
      if (teamsRequest === pending) {
        teamsRequest = null
        if (request === generation && status !== 'error'
          && ranking.teams.some((team) => !teams.has(team.teamId) && !requestedIds.has(team.teamId))) {
          refreshTeams(request)
        }
      }
    })
    teamsRequest = pending
    return pending
  }

  function receive(raw) {
    if (!connected) return
    try {
      const next = parseRanking(raw)
      if (ranking && next.revision <= ranking.revision) return
      ranking = next
      publish()
      if (ranking.teams.some((team) => !teams.has(team.teamId))) refreshTeams(generation)
    } catch {
      fail()
    }
  }

  async function load() {
    controller?.abort()
    controller = new AbortController()
    teamsRequest = null
    const request = ++generation
    status = ranking ? 'reconnecting' : 'loading'
    publish()
    try {
      const [rawRanking, rawTeams] = await Promise.all([
        readJson('/api/rankings', controller.signal),
        readJson('/api/teams', controller.signal),
      ])
      if (request !== generation) return
      const next = parseRanking(rawRanking)
      teams = parseTeams(rawTeams)
      if (!ranking || next.revision > ranking.revision) ranking = next
      status = 'live'
      publish()
      if (ranking.teams.some((team) => !teams.has(team.teamId))) refreshTeams(request)
    } catch {
      if (request === generation) fail()
    }
  }

  return {
    receive,
    setConnection(next) {
      if (next === 'live' && !connected) {
        connected = true
        load()
      } else if (next !== 'live' && connected) {
        connected = false
        generation += 1
        controller?.abort()
        teamsRequest = null
        status = next === 'error' ? 'error' : 'reconnecting'
        publish()
      } else if (next === 'error' && !connected) {
        fail()
      }
    },
    retry() {
      if (!connected) return false
      load()
      return true
    },
    stop() { connected = false; generation += 1; controller?.abort() },
  }
}
