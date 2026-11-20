import { useEffect, useState } from 'react'

const SECOND_MS = 1000

export function useCooldown() {
  const [deadline, setDeadline] = useState(null)
  const [seconds, setSeconds] = useState(null)

  function startCooldown(durationMs) {
    const duration = Math.max(0, durationMs)
    setDeadline(performance.now() + duration)
    setSeconds(Math.ceil(duration / SECOND_MS))
  }

  useEffect(() => {
    if (deadline === null) return
    let timeout

    function refresh() {
      const remainingMs = Math.max(0, deadline - performance.now())
      const remainingSeconds = Math.ceil(remainingMs / SECOND_MS)
      setSeconds(remainingSeconds)
      if (remainingSeconds > 0) {
        timeout = setTimeout(refresh, remainingMs - (remainingSeconds - 1) * SECOND_MS)
      }
    }

    refresh()
    return () => clearTimeout(timeout)
  }, [deadline])

  return { seconds, startCooldown }
}
