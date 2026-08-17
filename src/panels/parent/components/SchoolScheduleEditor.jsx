import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { WEEKDAY_KEYS } from '../../../utils/time'

const WEEKDAY_ONLY_KEYS = WEEKDAY_KEYS.slice(0, 5)

const DAY_LABELS = {
  pazartesi: 'Pazartesi',
  sali: 'Salı',
  carsamba: 'Çarşamba',
  persembe: 'Perşembe',
  cuma: 'Cuma',
  cumartesi: 'Cumartesi',
  pazar: 'Pazar',
}

const DEFAULT_START_TIME = '08:00'
const DEFAULT_END_TIME = '08:40'

/**
 * Haftanın 7 günü için ders saati aralıkları düzenleyicisi (hafta sonu dahil — bazı okulların
 * cumartesi/pazar kurs programı olabiliyor). Sihirbaz, profil modalı ve admin okul yönetimi
 * aynı bileşeni ve aynı girdi biçimini ({dayOfWeek, startTime, endTime}) kullanır. Hangi
 * derslerin okutulduğu ayrı bir listede (bkz. SubjectPicker) seçilir, burada tutulmaz.
 */
export default function SchoolScheduleEditor({ entries, onChange }) {
  const list = entries || []
  const [quickStart, setQuickStart] = useState(DEFAULT_START_TIME)
  const [quickEnd, setQuickEnd] = useState('17:00')

  const updateEntry = (index, field, value) => {
    onChange(list.map((entry, i) => (i === index ? { ...entry, [field]: value } : entry)))
  }

  const addEntry = (dayOfWeek) => {
    onChange([...list, { dayOfWeek, startTime: DEFAULT_START_TIME, endTime: DEFAULT_END_TIME }])
  }

  const removeEntry = (index) => {
    onChange(list.filter((_, i) => i !== index))
  }

  const applyToDays = (days) => {
    const kept = list.filter((entry) => !days.includes(entry.dayOfWeek))
    const applied = days.map((dayOfWeek) => ({ dayOfWeek, startTime: quickStart, endTime: quickEnd }))
    onChange([...kept, ...applied])
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl border border-panel-border bg-[#f8f7fb] p-3">
        <p className="mb-2 text-xs font-medium text-panel-text-muted">
          Hızlı ayarla: bir saat aralığı seçip günlere uygulayın, sonra istediğiniz günü tek tek değiştirebilirsiniz.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="time"
            value={quickStart}
            onChange={(event) => setQuickStart(event.target.value)}
            aria-label="Hızlı ayarla başlangıç saati"
            className="rounded-lg border border-panel-border bg-white p-1.5 text-sm text-panel-text"
          />
          <span className="text-xs text-panel-text-muted">–</span>
          <input
            type="time"
            value={quickEnd}
            onChange={(event) => setQuickEnd(event.target.value)}
            aria-label="Hızlı ayarla bitiş saati"
            className="rounded-lg border border-panel-border bg-white p-1.5 text-sm text-panel-text"
          />
          <button
            type="button"
            onClick={() => applyToDays(WEEKDAY_ONLY_KEYS)}
            className="rounded-lg border border-panel-border bg-white px-2.5 py-1.5 text-xs font-medium text-panel-text hover:bg-[#f0eef7]"
          >
            Hafta içi her güne uygula
          </button>
          <button
            type="button"
            onClick={() => applyToDays(WEEKDAY_KEYS)}
            className="rounded-lg border border-panel-border bg-white px-2.5 py-1.5 text-xs font-medium text-panel-text hover:bg-[#f0eef7]"
          >
            Tüm haftaya uygula
          </button>
        </div>
      </div>

      {WEEKDAY_KEYS.map((day) => {
        const dayEntries = list
          .map((entry, index) => ({ entry, index }))
          .filter(({ entry }) => entry.dayOfWeek === day)

        return (
          <div key={day} className="rounded-xl border border-panel-border p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold text-panel-text">{DAY_LABELS[day]}</span>
              <button
                type="button"
                onClick={() => addEntry(day)}
                className="inline-flex items-center gap-1 rounded-lg border border-panel-border bg-white px-2 py-1 text-xs font-medium text-panel-text hover:bg-[#f8f7fb]"
              >
                <Plus size={13} aria-hidden="true" />
                Saat Ekle
              </button>
            </div>

            {dayEntries.length === 0 ? (
              <p className="text-xs text-panel-text-muted">Bu gün için ders saati eklenmedi.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {dayEntries.map(({ entry, index }) => (
                  <div key={index} className="flex flex-wrap items-center gap-2">
                    <input
                      type="time"
                      value={entry.startTime}
                      onChange={(event) => updateEntry(index, 'startTime', event.target.value)}
                      aria-label="Başlangıç saati"
                      className="rounded-lg border border-panel-border p-1.5 text-sm text-panel-text"
                    />
                    <span className="text-xs text-panel-text-muted">–</span>
                    <input
                      type="time"
                      value={entry.endTime}
                      onChange={(event) => updateEntry(index, 'endTime', event.target.value)}
                      aria-label="Bitiş saati"
                      className="rounded-lg border border-panel-border p-1.5 text-sm text-panel-text"
                    />
                    <button
                      type="button"
                      onClick={() => removeEntry(index)}
                      aria-label="Bu saati kaldır"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-panel-text-muted hover:bg-panel-accent-soft hover:text-panel-warm"
                    >
                      <Trash2 size={15} aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
