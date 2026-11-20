import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { test } from 'node:test'
import { installProcessHandlers } from '../src/process-handlers.js'

// Un faux processus, un faux serveur et un faux logger : le test n'arrête pas le vrai processus de test.
function setup({ closeFails = false, neverCloses = false } = {}) {
  const proc = new EventEmitter()
  const logs = []
  const calls = []
  let resolveExit
  const exited = new Promise((resolve) => { resolveExit = resolve })
  const io = {
    close(callback) {
      calls.push('io.close')
      if (!neverCloses) callback()
    },
  }
  installProcessHandlers({
    io,
    httpServer: null,
    proc,
    timeoutMs: 50,
    disconnect: async () => {
      calls.push('disconnect')
      if (closeFails) throw new Error('base injoignable')
    },
    exit: (code) => {
      calls.push(`exit ${code}`)
      resolveExit(code)
    },
    logger: {
      info: (message, meta) => logs.push({ level: 'info', message, meta }),
      warn: (message, meta) => logs.push({ level: 'warn', message, meta }),
      error: (message, meta) => logs.push({ level: 'error', message, meta }),
    },
  })
  return { proc, logs, calls, exited }
}

test('SIGTERM ferme les sockets et le serveur, puis la base, et sort avec le code 0', async () => {
  const { proc, calls, exited } = setup()
  proc.emit('SIGTERM')
  assert.equal(await exited, 0)
  assert.deepEqual(calls, ['io.close', 'disconnect', 'exit 0'])
})

test('un second signal pendant l’arrêt est ignoré', async () => {
  const { proc, calls, exited } = setup()
  proc.emit('SIGINT')
  proc.emit('SIGTERM')
  await exited
  assert.deepEqual(calls, ['io.close', 'disconnect', 'exit 0'])
})

test('un plantage est journalisé avec sa pile, puis le back s’arrête avec le code 1', async () => {
  const { proc, logs, exited } = setup()
  proc.emit('uncaughtException', new TypeError('lecture de undefined'))
  assert.equal(await exited, 1)
  const crash = logs.find((log) => log.message === 'Plantage du processus')
  assert.equal(crash.level, 'error')
  assert.equal(crash.meta.kind, 'uncaughtException')
  assert.equal(crash.meta.errorName, 'TypeError')
  assert.match(crash.meta.stack, /at /)
})

test('une promesse rejetée sans catch est traitée comme un plantage', async () => {
  const { proc, exited } = setup()
  proc.emit('unhandledRejection', new Error('rejet oublié'))
  assert.equal(await exited, 1)
})

test('une erreur pendant l’arrêt est journalisée et donne le code 1', async () => {
  const { proc, logs, exited } = setup({ closeFails: true })
  proc.emit('SIGTERM')
  assert.equal(await exited, 1)
  assert.ok(logs.some((log) => log.message === 'Erreur pendant l’arrêt'))
})

test('si une connexion reste ouverte, l’arrêt est forcé après le délai', async () => {
  const { proc, logs, exited } = setup({ neverCloses: true })
  proc.emit('SIGTERM')
  assert.equal(await exited, 1)
  assert.ok(logs.some((log) => log.message.startsWith('Arrêt forcé')))
})
