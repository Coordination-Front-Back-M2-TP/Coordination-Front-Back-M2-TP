export async function cleanZone(zone, signal) {
  const response = await fetch('/api/moderation/cleanups', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(zone),
    signal,
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw Object.assign(new Error('Nettoyage refusé'), { code: payload?.error?.code })
  }
  const action = payload?.action
  if (action?.type !== 'zone_cleanup' || !Number.isSafeInteger(action.id) || action.id < 1
    || !Number.isSafeInteger(action.details?.removedCount) || action.details.removedCount < 0) {
    throw new Error('Action de modération invalide')
  }
  return { id: action.id, removedCount: action.details.removedCount }
}
