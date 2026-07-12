import { X } from 'lucide-react'
import { STRESS_SUPPORT_MESSAGES } from '../../../data/coachMessages'

const OPTIONS = [
  { id: 'breathe', label: '1 dakikalık nefes egzersizi' },
  { id: 'break', label: '5 dakika ara ver' },
  { id: 'shrink-plan', label: 'Bugünkü planı küçült' },
  { id: 'easy-task', label: 'Kolay bir görevle başla' },
  { id: 'notify-parent', label: 'Anneme haber ver' },
  { id: 'note-coach', label: 'Koçuma mesaj bırak' },
]

export default function StressSupportModal({ onSelectOption, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-0 md:items-center md:p-4">
      <div className="w-full max-w-md rounded-t-3xl border border-panel-border bg-panel-surface p-6 md:rounded-2xl">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-panel-text">Şu an çok bunaldım</h2>
          <button type="button" aria-label="Kapat" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <p className="mb-4 text-base text-panel-text-muted">{STRESS_SUPPORT_MESSAGES[0]}</p>
        <div className="flex flex-col gap-2">
          {OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => onSelectOption(option.id)}
              className="rounded-xl border border-panel-border px-4 py-3 text-left text-base font-medium text-panel-text hover:bg-panel-bg"
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
