import { useEffect, useState } from 'react'
import { BREATHING_STEPS } from '../../../data/coachMessages'

export default function BreathingExercise({ onClose }) {
  const [phaseIndex, setPhaseIndex] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState(BREATHING_STEPS[0].seconds)

  useEffect(() => {
    const interval = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current > 1) return current - 1
        setPhaseIndex((currentIndex) => (currentIndex + 1) % BREATHING_STEPS.length)
        return BREATHING_STEPS[(phaseIndex + 1) % BREATHING_STEPS.length].seconds
      })
    }, 1000)
    return () => window.clearInterval(interval)
  }, [phaseIndex])

  const phase = BREATHING_STEPS[phaseIndex]
  const scale = phase.phase === 'Nefes al' ? 'scale-110' : phase.phase === 'Nefes ver' ? 'scale-90' : 'scale-100'

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 bg-panel-blue-soft p-6">
      <div
        className={`flex h-40 w-40 items-center justify-center rounded-full bg-panel-blue text-white transition-transform duration-1000 ease-in-out ${scale}`}
      >
        <span className="text-2xl font-semibold">{secondsLeft}</span>
      </div>
      <p className="text-xl font-semibold text-panel-text">{phase.phase}</p>
      <p className="max-w-xs text-center text-base text-panel-text-muted">
        Her şeyi şu anda bitirmek zorunda değilsin. Bir sonraki küçük adımı birlikte seçelim.
      </p>
      <button
        type="button"
        onClick={onClose}
        className="rounded-xl border border-panel-border bg-white px-6 py-3 text-base font-medium text-panel-text"
      >
        Bitir
      </button>
    </div>
  )
}
