import { useEffect, useState } from 'react'
import { CalendarDays, GraduationCap, Phone, Plus, Trash2, X } from 'lucide-react'
import { authRequest } from '../../../services/authClient'
import LoadingState from '../../shared/LoadingState'
import Button from '../../ui/Button'

const TEACHER_TYPE_OPTIONS = [
  { value: 'okul_ogretmeni', label: 'Okul Öğretmeni' },
  { value: 'ozel_ogretmen', label: 'Özel Öğretmen' },
]

const WEEKDAY_OPTIONS = [
  { value: 'pazartesi', label: 'Pazartesi' },
  { value: 'sali', label: 'Salı' },
  { value: 'carsamba', label: 'Çarşamba' },
  { value: 'persembe', label: 'Perşembe' },
  { value: 'cuma', label: 'Cuma' },
  { value: 'cumartesi', label: 'Cumartesi' },
  { value: 'pazar', label: 'Pazar' },
]

const DEFAULT_SCHEDULE_ROW = {
  dayOfWeek: 'pazartesi',
  startTime: '17:00',
  endTime: '18:30',
}

function InfoChip({ icon, children }) {
  const Icon = icon
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-panel-text-muted">
      <Icon size={13} className="shrink-0 text-[#87a3a5]" aria-hidden="true" />
      {children}
    </span>
  )
}

export default function TeacherProfileModal({ teacher, onSaved, onClose }) {
  const [subjects, setSubjects] = useState(null)
  const [form, setForm] = useState({
    subjectId: teacher.subjectId || '',
    fullName: teacher.fullName || '',
    phone: teacher.phone || '',
    type: teacher.type || 'okul_ogretmeni',
    schedule: teacher.schedule || [],
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let ignore = false

    authRequest('/api/panel/subjects', { method: 'GET' })
      .then((data) => {
        if (!ignore) setSubjects(data.subjects)
      })
      .catch((err) => {
        if (!ignore) setError(err.message)
      })

    return () => {
      ignore = true
    }
  }, [])

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  const handleTypeChange = (type) => {
    setForm((current) => ({
      ...current,
      type,
      schedule:
        type === 'ozel_ogretmen' && current.schedule.length === 0
          ? [{ ...DEFAULT_SCHEDULE_ROW }]
          : current.schedule,
    }))
  }

  const handleScheduleChange = (index, field, value) => {
    setForm((current) => ({
      ...current,
      schedule: current.schedule.map((row, rowIndex) => (rowIndex === index ? { ...row, [field]: value } : row)),
    }))
  }

  const addScheduleRow = () => {
    setForm((current) => ({
      ...current,
      schedule: [...current.schedule, { ...DEFAULT_SCHEDULE_ROW }],
    }))
  }

  const removeScheduleRow = (index) => {
    setForm((current) => ({
      ...current,
      schedule: current.schedule.filter((_, rowIndex) => rowIndex !== index),
    }))
  }

  const validateForm = () => {
    if (!form.subjectId) return 'Ders seçin.'
    if (form.fullName.trim().length < 3) return 'Öğretmen ad soyadı en az 3 karakter olmalı.'
    if (form.phone.trim().length < 7) return 'Telefon bilgisi en az 7 karakter olmalı.'

    if (form.type === 'ozel_ogretmen') {
      const invalidSchedule = form.schedule.some((row) => !row.dayOfWeek || !row.startTime || !row.endTime || row.startTime >= row.endTime)
      if (invalidSchedule) return 'Ders günü ve saat aralığı geçerli olmalı.'
    }

    return ''
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      return
    }

    setError('')
    setSaving(true)
    try {
      const data = await authRequest(`/api/parent/students/${teacher.studentId}/teachers/${teacher.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          subjectId: form.subjectId,
          fullName: form.fullName,
          phone: form.phone,
          type: form.type,
          schedule: form.type === 'ozel_ogretmen' ? form.schedule : [],
        }),
      })
      onSaved(data.teacher)
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const isLoading = subjects === null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <form onSubmit={handleSubmit} className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-panel-2">
        <div className="flex items-center justify-between gap-4 border-b border-[#edf0f1] px-6 py-4">
          <h2 className="text-lg font-semibold text-panel-text">Öğretmen Profili</h2>
          <button type="button" aria-label="Kapat" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {error ? (
            <div className="mb-4 rounded-xl bg-panel-accent-soft px-4 py-3 text-sm text-panel-warm">{error}</div>
          ) : null}

          {isLoading ? (
            <LoadingState label="Öğretmen bilgileri yükleniyor..." />
          ) : (
            <div className="flex flex-col gap-5">
              <div className="flex items-center gap-5">
                <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#f5f2fb] text-[#655e94]">
                  <GraduationCap size={28} aria-hidden="true" />
                </span>

                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <p className="truncate text-lg font-semibold text-panel-text">{teacher.fullName}</p>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                    <InfoChip icon={Phone}>{teacher.phone || '—'}</InfoChip>
                    <InfoChip icon={CalendarDays}>{teacher.subjectName || 'Ders seçilmedi'}</InfoChip>
                  </div>
                </div>
              </div>

              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-panel-text-muted">Ders</span>
                <select
                  name="subjectId"
                  value={form.subjectId}
                  onChange={handleChange}
                  className="rounded-xl border border-panel-border bg-white p-2.5 text-base text-panel-text"
                  disabled={!subjects.length}
                >
                  {subjects.length ? null : <option value="">Ders yok</option>}
                  {subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-panel-text-muted">Öğretmen Ad Soyad</span>
                <input
                  name="fullName"
                  value={form.fullName}
                  onChange={handleChange}
                  className="rounded-xl border border-panel-border p-2.5 text-base text-panel-text"
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-panel-text-muted">Telefon</span>
                <input
                  name="phone"
                  type="tel"
                  value={form.phone}
                  onChange={handleChange}
                  className="rounded-xl border border-panel-border p-2.5 text-base text-panel-text"
                />
              </label>

              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium text-panel-text-muted">Öğretmen Tipi</span>
                <div className="grid grid-cols-2 gap-2">
                  {TEACHER_TYPE_OPTIONS.map((option) => {
                    const selected = form.type === option.value
                    return (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => handleTypeChange(option.value)}
                        className={`rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${
                          selected
                            ? 'border-[#655e94] bg-[#f5f2fb] text-[#655e94]'
                            : 'border-panel-border bg-white text-panel-text-muted hover:bg-panel-surface-soft'
                        }`}
                      >
                        {option.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {form.type === 'ozel_ogretmen' ? (
                <div className="flex flex-col gap-3 rounded-xl border border-[#e9edf0] bg-[#fbfcfc] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-sm font-semibold text-panel-text">
                      <CalendarDays size={16} aria-hidden="true" />
                      Ders Programı
                    </span>
                    <Button type="button" variant="secondary" size="sm" onClick={addScheduleRow}>
                      <Plus size={14} aria-hidden="true" />
                      Saat Ekle
                    </Button>
                  </div>

                  {form.schedule.length === 0 ? (
                    <p className="rounded-lg bg-[#f8f7fb] px-3 py-2 text-sm text-panel-text-muted">Program tanımlanmadı.</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {form.schedule.map((row, index) => (
                        <div key={index} className="grid grid-cols-1 gap-2 sm:grid-cols-[1.2fr_1fr_1fr_auto]">
                          <label className="flex flex-col gap-1">
                            <span className="text-xs font-medium text-panel-text-muted">Gün</span>
                            <select
                              value={row.dayOfWeek}
                              onChange={(event) => handleScheduleChange(index, 'dayOfWeek', event.target.value)}
                              className="h-10 rounded-lg border border-panel-border bg-white px-2 text-sm text-panel-text"
                            >
                              {WEEKDAY_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className="flex flex-col gap-1">
                            <span className="text-xs font-medium text-panel-text-muted">Başlangıç</span>
                            <input
                              type="time"
                              value={row.startTime}
                              onChange={(event) => handleScheduleChange(index, 'startTime', event.target.value)}
                              className="h-10 rounded-lg border border-panel-border bg-white px-2 text-sm text-panel-text"
                            />
                          </label>

                          <label className="flex flex-col gap-1">
                            <span className="text-xs font-medium text-panel-text-muted">Bitiş</span>
                            <input
                              type="time"
                              value={row.endTime}
                              onChange={(event) => handleScheduleChange(index, 'endTime', event.target.value)}
                              className="h-10 rounded-lg border border-panel-border bg-white px-2 text-sm text-panel-text"
                            />
                          </label>

                          <button
                            type="button"
                            aria-label="Ders saatini sil"
                            onClick={() => removeScheduleRow(index)}
                            className="flex h-10 items-center justify-center self-end rounded-lg border border-panel-border bg-white text-panel-text-muted hover:bg-panel-red-soft hover:text-panel-red"
                          >
                            <Trash2 size={15} aria-hidden="true" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-[#edf0f1] px-6 py-4">
          <Button type="button" variant="secondary" size="md" onClick={onClose} disabled={saving}>
            Vazgeç
          </Button>
          <Button type="submit" size="md" disabled={saving || isLoading}>
            {saving ? 'Kaydediliyor...' : 'Profili Kaydet'}
          </Button>
        </div>
      </form>
    </div>
  )
}
