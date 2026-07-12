import { MessageCircle } from 'lucide-react'

export default function MotivationMessageCard({ from, text, createdAt }) {
  const time = new Date(createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-panel-border bg-panel-lilac-soft p-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-panel-lilac">
        <MessageCircle size={18} aria-hidden="true" />
      </div>
      <div>
        <p className="text-sm font-medium text-panel-text-muted">
          {from === 'ebeveyn' ? 'Annenden mesaj' : 'Sana mesaj'} · {time}
        </p>
        <p className="mt-1 text-base text-panel-text">{text}</p>
      </div>
    </div>
  )
}
