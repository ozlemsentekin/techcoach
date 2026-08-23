import { useEffect, useRef } from 'react'

export default function useVisiblePolling(callback, intervalMs, { refreshOnVisible = true } = {}) {
  const callbackRef = useRef(callback)

  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  useEffect(() => {
    if (!intervalMs || intervalMs <= 0) return undefined

    let intervalId = null

    const stopPolling = () => {
      if (intervalId) {
        window.clearInterval(intervalId)
        intervalId = null
      }
    }

    const startPolling = () => {
      if (intervalId || document.visibilityState !== 'visible') return
      intervalId = window.setInterval(() => {
        callbackRef.current()
      }, intervalMs)
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if (refreshOnVisible) callbackRef.current()
        startPolling()
        return
      }
      stopPolling()
    }

    startPolling()
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      stopPolling()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [intervalMs, refreshOnVisible])
}
