import { useCallback, useEffect, useRef, useState } from 'react'
import { getDrawingAgent, readPlacedModel, startDrawingAgent, stopDrawingAgent } from '../api/drawing-agent.js'

const POLL_INTERVAL_MS = 2000
const MESSAGES = new Map([
  ['INVALID_MODEL_FILE', 'Choisissez un fichier JSON de 1 Mo maximum contenant entre 1 et 1 024 pixels dans « pixels ».'],
  ['INVALID_INPUT', 'Le modèle doit tenir dans 32 × 32 cases sur la toile, avec une couleur par case.'],
  ['UNAUTHORIZED', 'Reconnectez-vous pour utiliser votre agent de dessin.'],
  ['TEAM_REQUIRED', 'Rejoignez une équipe pour lancer l’agent.'],
  ['ACCOUNT_BANNED', 'Votre compte est banni et ne peut plus lancer d’agent.'],
  ['AGENT_ALREADY_ACTIVE', 'Un agent travaille déjà pour votre compte.'],
])

export function useDrawingAgent(enabled) {
  const request = useRef(null)
  const [agent, setAgent] = useState(null)
  const [loaded, setLoaded] = useState(false)
  const [syncError, setSyncError] = useState(false)
  const [error, setError] = useState(null)
  const [pending, setPending] = useState(false)

  const refresh = useCallback(() => {
    if (!enabled || request.current) return
    const controller = new AbortController()
    request.current = { controller, mutation: false }
    getDrawingAgent(controller.signal)
      .then((current) => {
        if (controller.signal.aborted) return
        setAgent(current)
        setLoaded(true)
        setSyncError(false)
      }, () => {
        if (!controller.signal.aborted) setSyncError(true)
      })
      .finally(() => {
        if (request.current?.controller === controller) request.current = null
      })
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    refresh()
    const polling = setInterval(refresh, POLL_INTERVAL_MS)
    return () => {
      clearInterval(polling)
      request.current?.controller.abort()
      request.current = null
    }
  }, [enabled, refresh])

  async function change(action, failure) {
    if (!enabled || request.current?.mutation) return
    // Une lecture en cours ne doit pas écraser le résultat du lancement ou de l’arrêt.
    request.current?.controller.abort()
    const controller = new AbortController()
    request.current = { controller, mutation: true }
    setPending(true)
    setError(null)
    try {
      const next = await action(controller.signal)
      if (controller.signal.aborted) return
      setAgent(next)
      setSyncError(false)
    } catch (reason) {
      if (!controller.signal.aborted) setError(MESSAGES.get(reason?.code) ?? failure)
    } finally {
      if (!controller.signal.aborted) {
        request.current = null
        setPending(false)
        refresh()
      }
    }
  }

  return {
    agent, loaded, syncError, error, pending, refresh,
    start: (file) => change(async (signal) => {
      const pixels = await readPlacedModel(file)
      signal.throwIfAborted()
      return startDrawingAgent(pixels, signal)
    }, 'Impossible de confirmer le lancement de l’agent.'),
    stop: () => change(stopDrawingAgent, 'Impossible de confirmer l’arrêt de l’agent.'),
  }
}
