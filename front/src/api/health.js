export async function getHealth(signal) {
  const response = await fetch('/api/health', { signal })
  if (!response.ok) throw new Error('Réponse du serveur invalide')
  const body = await response.json()
  if (body.status !== 'ok') throw new Error('État du serveur invalide')
}
