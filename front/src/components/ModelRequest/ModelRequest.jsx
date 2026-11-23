import { useState } from 'react'
import { MAX_PROMPT_LENGTH, MODERATION_LABELS } from '../../api/models.js'
import { useModelRequest } from '../../hooks/use-model-request.js'
import styles from './ModelRequest.module.css'

export function ModelRequest({ onModel }) {
  const [prompt, setPrompt] = useState('')
  const [preferredProvider, setPreferredProvider] = useState('jev')
  const { access, quotaError, generationError, pending, reload, submit } = useModelRequest(onModel)
  const providers = access?.moderationProviders ?? []
  const provider = providers.includes(preferredProvider) ? preferredProvider : providers[0]
  const length = [...prompt.trim()].length

  return (
    <form className={styles.form} aria-label="Générer un modèle" onSubmit={(event) => {
      event.preventDefault()
      if (length > 0 && length <= MAX_PROMPT_LENGTH) submit(prompt.trim(), provider)
    }}>
      {access ? (
        <p role="status">
          {access.quota.remaining > 0
            ? `Modèles disponibles aujourd’hui : ${access.quota.remaining} sur ${access.quota.limit}.`
            : 'Le quota de modèles est épuisé pour aujourd’hui.'}
        </p>
      ) : !quotaError && <p role="status">Lecture du quota…</p>}
      {quotaError && (
        <p>
          <span role="alert">Le quota de modèles est indisponible. </span>
          <button type="button" onClick={reload}>Relire le quota</button>
        </p>
      )}
      <label className={styles.prompt}>
        Consigne du modèle
        <textarea rows={2} required disabled={pending} value={prompt} onChange={(event) => setPrompt(event.target.value)} />
      </label>
      {length > MAX_PROMPT_LENGTH && <p role="alert">La consigne est limitée à {MAX_PROMPT_LENGTH} caractères.</p>}
      {providers.length > 1 && (
        <label>
          Vérification de la consigne
          <select value={provider} disabled={pending} onChange={(event) => setPreferredProvider(event.target.value)}>
            {providers.map((value) => <option key={value} value={value}>{MODERATION_LABELS[value]}</option>)}
          </select>
        </label>
      )}
      {providers.length === 1 && <p>Consigne vérifiée par {MODERATION_LABELS[provider]}.</p>}
      {access && providers.length === 0 && <p>Aucun service de modération disponible.</p>}
      <button type="submit" disabled={pending || !access?.quota.remaining || !provider || length === 0 || length > MAX_PROMPT_LENGTH}>
        {pending ? 'Génération en cours…' : 'Générer le modèle'}
      </button>
      {generationError && <p role="alert">{generationError}</p>}
    </form>
  )
}
