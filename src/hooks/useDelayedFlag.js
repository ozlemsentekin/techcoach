import { useEffect, useState } from 'react'

// `active` true olduktan `delayMs` sonra true döner; `active` false olur olmaz sıfırlanır.
// Kısa süren yüklemelerde hiç true olmaz — yalnızca beklenenden uzun sürenlerde tetiklenir.
export default function useDelayedFlag(active, delayMs = 6000) {
  const [fired, setFired] = useState(false)

  useEffect(() => {
    if (!active) return undefined
    const timer = setTimeout(() => setFired(true), delayMs)
    return () => {
      clearTimeout(timer)
      setFired(false)
    }
  }, [active, delayMs])

  // `active` false olduğunda `fired` henüz sıfırlanmamış olsa bile (cleanup bir sonraki
  // effect'te çalışır) sonucu doğru veren türetilmiş değer.
  return active && fired
}
