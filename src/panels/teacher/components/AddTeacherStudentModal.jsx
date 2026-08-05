import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { authRequest } from '../../../services/authClient'
import { addTeacherStudent, getTeacherEntitlement } from '../../../services/teacherService'
import Button from '../../ui/Button'
import LoadingState from '../../shared/LoadingState'

const TEACHER_TYPE_OPTIONS = [
  { value: 'okul_ogretmeni', label: 'Okul Öğretmeni' },
  { value: 'ozel_ogretmen', label: 'Özel Öğretmen' },
]

const INITIAL_FORM = {
  studentFullName: '',
  subjectId: '',
  teacherType: 'okul_ogretmeni',
  parentFullName: '',
  parentPhone: '',
}

export default function AddTeacherStudentModal({ onCreated, onClose }) {
  const [subjects, setSubjects] = useState(null)
  const [entitlement, setEntitlement] = useState(null)
  const [form, setForm] = useState(INITIAL_FORM)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let ignore = false

    Promise.all([authRequest('/api/panel/subjects', { method: 'GET' }), getTeacherEntitlement()])
      .then(([subjectsData, entitlementData]) => {
        if (ignore) return
        setSubjects(subjectsData.subjects)
        setEntitlement(entitlementData)
        setForm((current) => ({ ...current, subjectId: current.subjectId || subjectsData.subjects?.[0]?.id || '' }))
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

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (form.studentFullName.trim().length < 3) {
      setError('Öğrenci adı en az 3 karakter olmalı.')
      return
    }
    if (!form.subjectId) {
      setError('Ders seçin.')
      return
    }
    if (form.parentFullName.trim().length < 3) {
      setError('Veli adı en az 3 karakter olmalı.')
      return
    }
    if (form.parentPhone.trim().length < 7) {
      setError('Veli telefon numarası en az 7 karakter olmalı.')
      return
    }

    setError('')
    setSaving(true)
    try {
      const data = await addTeacherStudent(form)
      onCreated(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const isLoading = subjects === null || entitlement === null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-md panel-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-panel-text">Öğrenci Ekle</h2>
          <button type="button" aria-label="Kapat" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {isLoading ? (
          <LoadingState label="Yükleniyor..." />
        ) : (
          <>
            {!entitlement.isActive ? (
              <div className="mb-3 rounded-xl bg-panel-accent-soft px-3 py-2.5 text-sm text-panel-warm">
                Panel aboneliğiniz aktif değil, öğrenci ekleyemezsiniz.
              </div>
            ) : (
              <p className="mb-3 text-sm text-panel-text-muted">
                Kalan öğrenci hakkınız: <strong className="text-panel-text">{entitlement.remainingSeats}</strong> /{' '}
                {entitlement.totalSeats}. Eklediğiniz öğrencinin velisinin zaten aktif bir planı varsa hakkınız
                harcanmaz.
              </p>
            )}

            {error ? (
              <div className="mb-3 rounded-xl bg-panel-accent-soft px-3 py-2.5 text-sm text-panel-warm">{error}</div>
            ) : null}

            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-panel-text-muted">Öğrenci Ad Soyad</span>
                <input
                  name="studentFullName"
                  value={form.studentFullName}
                  onChange={handleChange}
                  className="rounded-xl border border-panel-border p-2.5 text-base text-panel-text"
                />
              </label>

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

              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium text-panel-text-muted">Öğretmen Tipi</span>
                <div className="grid grid-cols-2 gap-2">
                  {TEACHER_TYPE_OPTIONS.map((option) => {
                    const selected = form.teacherType === option.value
                    return (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setForm((current) => ({ ...current, teacherType: option.value }))}
                        className={`rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${
                          selected
                            ? 'border-panel-blue bg-panel-blue-soft text-panel-blue'
                            : 'border-panel-border bg-white text-panel-text-muted hover:bg-panel-surface-soft'
                        }`}
                      >
                        {option.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-panel-text-muted">Veli Ad Soyad</span>
                <input
                  name="parentFullName"
                  value={form.parentFullName}
                  onChange={handleChange}
                  className="rounded-xl border border-panel-border p-2.5 text-base text-panel-text"
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-panel-text-muted">Veli Telefon</span>
                <input
                  name="parentPhone"
                  type="tel"
                  value={form.parentPhone}
                  onChange={handleChange}
                  className="rounded-xl border border-panel-border p-2.5 text-base text-panel-text"
                />
              </label>

              <Button type="submit" disabled={saving || !entitlement.isActive} className="w-full">
                {saving ? 'Ekleniyor...' : 'Öğrenciyi Ekle'}
              </Button>
            </div>
          </>
        )}
      </form>
    </div>
  )
}
