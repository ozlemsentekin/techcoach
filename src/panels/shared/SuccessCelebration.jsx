import { useState } from 'react'
import ConfettiBurst from './ConfettiBurst'

// %100 başarı kutlaması: konfeti + ortada motivasyon mesajı kartı. Kullanıcı "Tamam"a
// (veya arka plana) basınca kapanır. Öğrenci optik kaydı ve veli Kitaplık sonuç girişinde
// ortak kullanılır.
const MESSAGES = [
  'Harika bir iş çıkardın, aynen böyle devam et!',
  'Tam isabet! Emeğinin karşılığını aldın, gurur duyduk.',
  'Mükemmel! Tüm soruları doğru yaptın — böyle devam!',
  'Süpersin! Bu başarı senin çalışmanın sonucu.',
  'Bravo! %100 başarı kolay değil, sen başardın.',
]

function pickMessage() {
  return MESSAGES[Math.floor(Math.random() * MESSAGES.length)]
}

export default function SuccessCelebration({ onClose, title = 'Tebrikler! 🎉' }) {
  const [message] = useState(pickMessage)

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <ConfettiBurst />
      <div
        className="fade-slide-in relative w-full max-w-xs rounded-2xl border border-panel-border bg-panel-surface p-6 text-center shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="text-4xl" aria-hidden="true">
          🌟
        </div>
        <h2 className="mt-2 text-lg font-bold text-panel-text">{title}</h2>
        <p className="mt-2 text-sm text-panel-text-muted">{message}</p>
        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-xl bg-panel-blue px-4 py-3 text-sm font-semibold text-white hover:bg-panel-blue/90"
        >
          Tamam
        </button>
      </div>
    </div>
  )
}
