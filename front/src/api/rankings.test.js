import { afterEach, expect, it, vi } from 'vitest'
import { createRankingFeed } from './rankings.js'

const ranking = (revision, teams = []) => ({ revision, teams })
const red = { id: 'rouge', name: 'Rouge', color: '#D93A3A' }
const entry = (teamId, pixelCount, rank) => ({ teamId, pixelCount, rank })
const response = (body) => ({ ok: true, json: async () => body })
const flush = async () => { for (let i = 0; i < 10; i += 1) await Promise.resolve() }

afterEach(() => { vi.unstubAllGlobals() })

it('garde les événements plus récents que la lecture initiale et ignore les doublons', async () => {
  let resolveRanking
  vi.stubGlobal('fetch', vi.fn((url) => url.endsWith('rankings')
    ? new Promise((resolve) => { resolveRanking = resolve })
    : Promise.resolve(response({ teams: [red] }))))
  const states = []
  const feed = createRankingFeed((state) => states.push(state))
  feed.setConnection('live')
  feed.receive(ranking(2, [entry('rouge', 2, 1)]))
  resolveRanking(response(ranking(1, [entry('rouge', 1, 1)])))
  await flush()
  feed.receive(ranking(1, []))
  expect(states.at(-1).ranking).toEqual(ranking(2, [entry('rouge', 2, 1)]))
  expect(states.at(-1).status).toBe('live')
  feed.stop()
})

it('relit les équipes pour un identifiant inconnu puis actualise les noms', async () => {
  const blue = { id: 'bleue', name: 'Bleue', color: '#2F6FDE' }
  let teamReads = 0
  vi.stubGlobal('fetch', vi.fn(async (url) => response(url.endsWith('rankings')
    ? ranking(0) : { teams: ++teamReads === 1 ? [red] : [red, blue] })))
  const states = []
  const feed = createRankingFeed((state) => states.push(state))
  feed.setConnection('live')
  await flush()
  feed.receive(ranking(1, [entry('bleue', 1, 1)]))
  await flush()
  expect(teamReads).toBe(2)
  expect(states.at(-1).teams.get('bleue')).toEqual(blue)
  feed.stop()
})

it('signale une coupure, relit le classement à la reconnexion et ignore les réponses périmées', async () => {
  const pending = []
  vi.stubGlobal('fetch', vi.fn((url) => new Promise((resolve) => pending.push({ url, resolve }))))
  const states = []
  const feed = createRankingFeed((state) => states.push(state))
  feed.setConnection('live')
  feed.setConnection('reconnecting')
  feed.setConnection('live')
  pending[2].resolve(response(ranking(3, [entry('rouge', 3, 1)])))
  pending[3].resolve(response({ teams: [red] }))
  await flush()
  pending[0].resolve(response(ranking(1)))
  pending[1].resolve(response({ teams: [] }))
  await flush()
  expect(states.at(-1).ranking.revision).toBe(3)
  expect(states.at(-1).status).toBe('live')
  feed.stop()
})

it('permet de réessayer après une erreur sans exposer les détails', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('secret'))
    .mockResolvedValueOnce(response({ teams: [red] }))
    .mockResolvedValueOnce(response(ranking(0)))
    .mockResolvedValueOnce(response({ teams: [red] })))
  const states = []
  const feed = createRankingFeed((state) => states.push(state))
  feed.setConnection('live')
  await flush()
  expect(states.at(-1).status).toBe('error')
  expect(JSON.stringify(states)).not.toContain('secret')
  feed.retry()
  await flush()
  expect(states.at(-1).status).toBe('live')
  feed.stop()
})
