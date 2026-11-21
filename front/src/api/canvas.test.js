import { beforeEach, describe, expect, it, vi } from 'vitest'
import { subscribeCanvas } from './canvas.js'

const date = '2026-10-27T14:30:00.000Z'
const pixel = (overrides = {}) => ({ x: 0, y: 0, color: '#D93A3A', revision: 11, updatedAt: date, ...overrides })
const snapshot = (overrides = {}) => ({ width: 101, height: 101, revision: 10, snapshotAt: date, pixels: [], ...overrides })
const cleared = (overrides = {}) => ({ fromX: 0, fromY: 0, toX: 1, toY: 1, revision: 12, clearedAt: date, ...overrides })

function fakeSocket() {
  const listeners = new Map()
  const acknowledgements = []
  const socket = {
    connected: false,
    active: true,
    on: vi.fn((event, handler) => { listeners.set(event, handler); return socket }),
    off: vi.fn((event) => { listeners.delete(event); return socket }),
    timeout: vi.fn(() => socket),
    emit: vi.fn((event, callback) => {
      if (event === 'canvas:subscribe') acknowledgements.push(callback)
      return socket
    }),
    connect: vi.fn(() => { socket.connected = true; listeners.get('connect')(); return socket }),
    disconnect: vi.fn(() => { socket.connected = false; socket.active = false; return socket }),
  }
  return { socket, listeners, acknowledgements, receive: (event, value) => listeners.get(event)?.(value) }
}

describe('abonnement à la toile', () => {
  let transport
  let states
  let stop

  beforeEach(() => {
    transport = fakeSocket()
    states = []
    stop = subscribeCanvas((state) => states.push(state), { createSocket: () => transport.socket })
  })

  it('installe l’instantané puis les événements arrivés avant l’ACK, dans l’ordre des révisions', () => {
    transport.receive('pixel:updated', pixel({ revision: 12, color: '#2563EB' }))
    transport.receive('pixel:updated', pixel({ revision: 11 }))
    transport.receive('pixel:updated', pixel({ x: 1, revision: 9 }))
    expect(states.at(-1).canvas).toBeNull()
    transport.acknowledgements[0](null, snapshot())
    expect(states.at(-1).status).toBe('live')
    expect(states.at(-1).canvas.pixels.get('0,0').color).toBe('#2563EB')
    expect(states.at(-1).canvas.pixels.has('1,0')).toBe(false)
  })

  it('applique immédiatement un changement sans faire régresser le pixel sur un doublon', () => {
    transport.acknowledgements[0](null, snapshot())
    transport.receive('pixel:updated', pixel({ revision: 12 }))
    transport.receive('pixel:updated', pixel({ revision: 11, color: '#2563EB' }))
    expect(states.at(-1).canvas.pixels.get('0,0').color).toBe('#D93A3A')
  })

  it('rejoue un nettoyage et les poses tamponnés après l’instantané', () => {
    transport.receive('canvas:cleared', cleared({ revision: 10, fromX: -1 }))
    transport.receive('pixel:updated', pixel({ x: 1, revision: 13 }))
    transport.receive('canvas:cleared', cleared())
    transport.receive('pixel:updated', pixel({ revision: 11 }))
    transport.acknowledgements[0](null, snapshot({ pixels: [pixel({ x: -1, revision: 10 })] }))
    expect(states.at(-1).status).toBe('live')
    expect([...states.at(-1).canvas.pixels.keys()]).toEqual(['-1,0', '1,0'])
  })

  it('conserve les poses récentes et empêche une ancienne pose de réapparaître après un nettoyage', () => {
    transport.acknowledgements[0](null, snapshot({ pixels: [pixel({ revision: 10 })] }))
    transport.receive('pixel:updated', pixel({ x: 1, y: 1, revision: 14 }))
    transport.receive('canvas:cleared', cleared({ revision: 13 }))
    transport.receive('canvas:cleared', cleared())
    transport.receive('pixel:updated', pixel({ revision: 12 }))
    transport.receive('pixel:updated', pixel({ x: 1, revision: 11 }))
    transport.receive('pixel:updated', pixel({ x: 2, revision: 11 }))
    expect([...states.at(-1).canvas.pixels.keys()]).toEqual(['1,1', '2,0'])
    transport.receive('pixel:updated', pixel({ revision: 15 }))
    expect(states.at(-1).canvas.pixels.get('0,0').revision).toBe(15)
  })

  it('rejette une zone de nettoyage dont les coins sont hors de la toile', () => {
    transport.acknowledgements[0](null, snapshot())
    transport.receive('canvas:cleared', cleared({ toX: Number.MAX_SAFE_INTEGER }))
    expect(states.at(-1).status).toBe('error')
  })

  it('remplace la toile à la reconnexion et abandonne l’ancien tampon', () => {
    transport.receive('pixel:updated', pixel())
    transport.socket.connected = false
    transport.receive('disconnect')
    transport.socket.connected = true
    transport.receive('connect')
    transport.acknowledgements[0](null, snapshot({ pixels: [pixel({ revision: 10 })] }))
    expect(states.at(-1).status).not.toBe('live')
    transport.acknowledgements[1](null, snapshot({ revision: 20 }))
    expect(states.at(-1).canvas.pixels.size).toBe(0)
  })

  it('garde le dernier état en signalant la déconnexion, puis accepte le nouvel instantané', () => {
    transport.acknowledgements[0](null, snapshot({ pixels: [pixel({ revision: 10 })] }))
    transport.socket.connected = false
    transport.receive('disconnect')
    expect(states.at(-1).status).toBe('reconnecting')
    expect(states.at(-1).canvas.pixels.size).toBe(1)
    transport.socket.connected = true
    transport.receive('connect')
    transport.acknowledgements[1](null, snapshot({ revision: 20 }))
    expect(states.at(-1).status).toBe('live')
    expect(states.at(-1).canvas.pixels.size).toBe(0)
  })

  it.each(['canvas:error', 'connect_error'])('présente %s sans conserver le détail interne', (event) => {
    transport.receive(event, { error: { message: 'secret', stack: 'secret' } })
    expect(states.at(-1).status).toBe('error')
    expect(JSON.stringify(states)).not.toContain('secret')
    transport.acknowledgements[0](null, snapshot())
    expect(states.at(-1).status).toBe('error')
  })

  it('signale un ACK absent ou invalide au lieu de rester en chargement', () => {
    transport.acknowledgements[0](new Error('secret'))
    expect(states.at(-1).status).toBe('error')
    expect(JSON.stringify(states)).not.toContain('secret')
  })

  it('signale les données incompatibles sans afficher une fausse toile à jour', () => {
    transport.acknowledgements[0](null, snapshot())
    transport.receive('pixel:updated', pixel({ x: 51 }))
    expect(states.at(-1).status).toBe('error')
    transport.receive('pixel:updated', pixel())
    expect(states.at(-1).canvas.pixels.size).toBe(0)
  })

  it('se désabonne et retire ses écouteurs au démontage, en ignorant un ACK tardif', () => {
    stop()
    const count = states.length
    transport.acknowledgements[0](null, snapshot())
    expect(states).toHaveLength(count)
    expect(transport.socket.emit).toHaveBeenCalledWith('canvas:unsubscribe')
    expect(transport.listeners.size).toBe(0)
    expect(transport.socket.disconnect).toHaveBeenCalledOnce()
  })

  it('ne met pas de désabonnement en attente pendant une coupure réseau', () => {
    transport.socket.connected = false
    transport.receive('disconnect')
    stop()
    expect(transport.socket.emit).not.toHaveBeenCalledWith('canvas:unsubscribe')
  })
})

it('transmet le classement uniquement pendant un abonnement actif', () => {
  const transport = fakeSocket()
  const onRanking = vi.fn()
  const stop = subscribeCanvas(() => {}, { createSocket: () => transport.socket, onRanking })
  const ranking = { revision: 2, teams: [] }
  transport.receive('ranking:updated', ranking)
  expect(onRanking).toHaveBeenCalledWith(ranking)
  transport.receive('disconnect')
  transport.receive('ranking:updated', ranking)
  expect(onRanking).toHaveBeenCalledOnce()
  stop()
})
