import { useCallback, useEffect, useRef, useState } from 'react'
import { generateModel, getModelQuota } from '../api/models.js'

const ERRORS = {
  INVALID_INPUT: 'Vérifiez votre consigne et le service choisi.',
  MODEL_QUOTA_EXHAUSTED: 'Le quota était épuisé au moment de l’envoi.',
  MODEL_REQUEST_IN_PROGRESS: 'Une génération est déjà en cours pour ce compte.',
  PROMPT_REJECTED: 'La consigne a été refusée. Votre quota reste intact.',
  UNAUTHORIZED: 'Reconnectez-vous pour demander un modèle.',
}

export function useModelRequest(onModel) {
  const [access, setAccess] = useState(null)
  const [quotaError, setQuotaError] = useState(false)
  const [generationError, setGenerationError] = useState('')
  const [pending, setPending] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const generation = useRef(null)

  const reload = useCallback(() => {
    setAccess(null)
    setQuotaError(false)
    setAttempt((value) => value + 1)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    getModelQuota(controller.signal).then((data) => {
      if (!controller.signal.aborted) setAccess(data)
    }).catch(() => {
      if (!controller.signal.aborted) setQuotaError(true)
    })
    return () => controller.abort()
  }, [attempt])

  useEffect(() => () => generation.current?.abort(), [])

  const refreshAt = access?.refreshAt
  useEffect(() => {
    if (refreshAt === undefined || pending) return
    const remaining = refreshAt - Date.now()
    // Une réponse déjà expirée peut venir d’une horloge décalée. Espacer les nouvelles lectures.
    const timer = setTimeout(reload, remaining > 0 ? remaining : 60_000)
    return () => clearTimeout(timer)
  }, [refreshAt, pending, reload])

  async function submit(prompt, provider) {
    if (generation.current || !access?.quota.remaining || !access.moderationProviders.includes(provider)) return
    const controller = new AbortController()
    generation.current = controller
    setPending(true)
    setGenerationError('')
    try {
      const { model, quota, refreshAt } = await generateModel(prompt, provider, controller.signal)
      if (controller.signal.aborted) return
      setAccess({ ...access, quota, refreshAt })
      onModel(model)
    } catch (error) {
      if (controller.signal.aborted) return
      const message = Object.hasOwn(ERRORS, error?.code) ? ERRORS[error.code] : null
      setGenerationError(message ?? 'Impossible de générer le modèle. Réessayez dans un instant.')
      if (!message || error.code === 'MODEL_QUOTA_EXHAUSTED') reload()
    } finally {
      if (!controller.signal.aborted) {
        generation.current = null
        setPending(false)
      }
    }
  }

  return { access, quotaError, generationError, pending, reload, submit }
}
