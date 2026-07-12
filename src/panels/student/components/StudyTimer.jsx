import { useEffect, useRef, useState } from 'react'
import { formatSecondsAsTimer } from '../../../utils/time'

export default function StudyTimer({ onElapsedChange }) {
  const [isRunning, setIsRunning] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const intervalRef = useRef(null)

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = window.setInterval(() => {
        setElapsedSeconds((current) => current + 1)
      }, 1000)
    }
    return () => window.clearInterval(intervalRef.current)
  }, [isRunning])

  useEffect(() => {
    onElapsedChange?.(elapsedSeconds)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsedSeconds])

  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-panel-border bg-panel-bg p-6">
      <p className="font-mono text-5xl font-semibold text-panel-text" aria-live="polite">
        {formatSecondsAsTimer(elapsedSeconds)}
      </p>
      <div className="flex gap-2">
        {!isRunning ? (
          <button
            type="button"
            onClick={() => setIsRunning(true)}
            className="rounded-xl bg-panel-blue px-6 py-3 text-base font-semibold text-white"
          >
            {elapsedSeconds === 0 ? 'Başlat' : 'Devam Et'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setIsRunning(false)}
            className="rounded-xl border border-panel-border bg-white px-6 py-3 text-base font-medium text-panel-text"
          >
            Duraklat
          </button>
        )}
      </div>
    </div>
  )
}
