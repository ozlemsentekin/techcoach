import { useState } from 'react'
import { saveParentMessage } from '../../../services/motivationMessageService'
import { todayISODate } from '../../../utils/time'

const PRESET_MESSAGES = [
  'Bugün başlaman bile çok değerliydi.',
  'Zorlandığın halde devam ettiğini görüyorum.',
  'Akşam istersen birlikte yanlışlarına bakabiliriz.',
  'Bugün dinlenmeye de zaman ayırmanı istiyorum.',
  'Emeğini görüyorum ve seninle gurur duyuyorum.',
]

export default function MotivationMessageForm({ onSaved }) {
  const [body, setBody] = useState('')
  const [displayDate, setDisplayDate] = useState(todayISODate())
  const [priority, setPriority] = useState('normal')

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!body.trim()) return
    await saveParentMessage({ body: body.trim(), displayDate, priority })
    setBody('')
    setPriority('normal')
    onSaved?.()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 panel-card p-4">
      <p className="text-sm font-medium text-panel-text-muted">Hazır bir mesaj seç veya kendin yaz</p>

      <div className="flex flex-wrap gap-2">
        {PRESET_MESSAGES.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => setBody(preset)}
            className="rounded-full border border-panel-border px-3 py-1.5 text-left text-sm text-panel-text hover:bg-panel-surface-soft"
          >
            {preset}
          </button>
        ))}
      </div>

      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="Motivasyon mesajını yaz"
        rows={3}
        className="rounded-xl border border-panel-border p-3 text-base text-panel-text"
      />

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-panel-text-muted">
          Gösterim tarihi
          <input
            type="date"
            value={displayDate}
            onChange={(event) => setDisplayDate(event.target.value)}
            className="rounded-lg border border-panel-border px-2 py-1 text-panel-text"
          />
        </label>

        <label className="flex items-center gap-2 text-sm text-panel-text-muted">
          Öncelik
          <select
            value={priority}
            onChange={(event) => setPriority(event.target.value)}
            className="rounded-lg border border-panel-border px-2 py-1 text-panel-text"
          >
            <option value="normal">Normal</option>
            <option value="high">Yüksek</option>
          </select>
        </label>

        <button
          type="submit"
          className="ml-auto rounded-xl bg-panel-blue px-4 py-2 text-sm font-semibold text-white"
        >
          Mesajı Ata
        </button>
      </div>
    </form>
  )
}
