import { useEffect, useState } from 'react'

// %100 başarı kutlaması. Ekranın ortasından bir avuç emoji fırlatır ve ~1.5 sn sonra
// kendini söker. Tıklamayı engellemez (pointer-events yok). Kütüphane gerektirmez —
// animasyon index.css'teki .confetti-piece / @keyframes confetti-pop ile yapılır.
const EMOJIS = ['🎉', '🎊', '✨', '🎉', '⭐', '🎊', '✨', '🎉', '⭐', '🎊', '✨', '🎉']

function buildPieces() {
  return EMOJIS.map((emoji, index) => {
    const angle = (Math.PI * (index + 0.5)) / EMOJIS.length + (Math.random() - 0.5) * 0.4
    const distance = 120 + Math.random() * 160
    return {
      emoji,
      dx: `${Math.cos(angle) * distance}px`,
      dy: `${-Math.abs(Math.sin(angle)) * distance - 40}px`,
      rot: `${(Math.random() - 0.5) * 540}deg`,
      delay: `${Math.random() * 120}ms`,
      size: `${1.4 + Math.random() * 1.1}rem`,
    }
  })
}

export default function ConfettiBurst({ onDone, duration = 1600 }) {
  const [pieces] = useState(buildPieces)

  useEffect(() => {
    if (!onDone) return undefined
    const timer = setTimeout(onDone, duration)
    return () => clearTimeout(timer)
  }, [onDone, duration])

  return (
    <div className="pointer-events-none fixed inset-0 z-[100] overflow-hidden" aria-hidden="true">
      {pieces.map((piece, index) => (
        <span
          key={index}
          className="confetti-piece absolute left-1/2 top-1/2 select-none"
          style={{
            fontSize: piece.size,
            '--confetti-dx': piece.dx,
            '--confetti-dy': piece.dy,
            '--confetti-rot': piece.rot,
            '--confetti-delay': piece.delay,
          }}
        >
          {piece.emoji}
        </span>
      ))}
    </div>
  )
}
