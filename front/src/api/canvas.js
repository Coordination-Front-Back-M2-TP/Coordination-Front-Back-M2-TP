import { applyCanvasRevert, parseCanvasRevert } from './canvas-revert.js'
import { io } from 'socket.io-client'
import { applyPixelUpdate, parseCanvasSnapshot, parsePixel } from './canvas-state.js'

const SUBSCRIBE_TIMEOUT_MS = 10_000

export function subscribeCanvas(onChange, { createSocket = () => io({ autoConnect: false }), onRanking = () => {} } = {}) {
  const socket = createSocket()
  let canvas = null
  let pending = []
  let awaitingSnapshot = false
  let subscribed = false
  let disposed = false
  let generation = 0

  const publish = (status) => onChange({ canvas, status })
  const invalidate = () => {
    generation += 1
    pending = []
    awaitingSnapshot = false
    subscribed = false
  }

  function fail() {
    if (disposed) return
    invalidate()
    if (socket.connected) socket.emit('canvas:unsubscribe')
    publish('error')
  }

  function onConnect() {
    if (disposed) return
    const request = ++generation
    pending = []
    awaitingSnapshot = true
    subscribed = true
    publish(canvas ? 'reconnecting' : 'loading')
    socket.timeout(SUBSCRIBE_TIMEOUT_MS).emit('canvas:subscribe', (error, snapshot) => {
      if (disposed || request !== generation) return
      if (error) return fail()
      try {
        let next = parseCanvasSnapshot(snapshot)
        // Un changement peut précéder l’ACK : l’instantané reste le point de départ.
        for (const { apply, event } of pending.sort((a, b) => a.event.revision - b.event.revision)) {
          next = apply(next, event)
        }
        canvas = next
        pending = []
        awaitingSnapshot = false
        publish('live')
      } catch {
        fail()
      }
    })
  }

  function receive(raw, parse, apply) {
    if (disposed || !subscribed) return
    try {
      if (awaitingSnapshot) {
        pending.push({ apply, event: parse(raw) })
      } else {
        const next = apply(canvas, raw)
        if (next !== canvas) {
          canvas = next
          publish('live')
        }
      }
    } catch {
      fail()
    }
  }

  function onDisconnect() {
    if (disposed) return
    invalidate()
    publish(socket.active ? 'reconnecting' : 'error')
  }

  function onConnectError() {
    if (disposed) return
    invalidate()
    publish(canvas && socket.active ? 'reconnecting' : 'error')
  }

  const listeners = {
    connect: onConnect,
    disconnect: onDisconnect,
    connect_error: onConnectError,
    'pixel:updated': (raw) => receive(raw, parsePixel, applyPixelUpdate),
    'ranking:updated': (ranking) => { if (!disposed && subscribed) onRanking(ranking) },
    'canvas:error': fail,
    'canvas:reverted': (raw) => receive(raw, parseCanvasRevert, applyCanvasRevert),
  }
  for (const [event, handler] of Object.entries(listeners)) socket.on(event, handler)
  publish('loading')
  socket.connect()

  return () => {
    disposed = true
    if (socket.connected && subscribed) socket.emit('canvas:unsubscribe')
    invalidate()
    for (const [event, handler] of Object.entries(listeners)) socket.off(event, handler)
    socket.disconnect()
  }
}
