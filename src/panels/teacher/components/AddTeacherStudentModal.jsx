import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { authRequest } from '../../../services/authClient'
import { addTeacherStudent, getTeacherEntitlement } from '../../../services/teacherService'
import { useAuth } from '../../../context/useAuth'
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
  const { authUser } = useAuth()
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
      })
      .catch((err) => {
        if (!ignore) setError(err.message)
      })

    return () => {
      ignore = true
    }
  }, [])

  // Öğretmenler yalnızca kendi profilindeki derslerden öğrenci ekleyebilir; branşı henüz
  // atanmamış (eski) hesaplarda geriye dönük uyumluluk için tüm dersler gösterilir.
  const teacherSubjectIds = authUser?.teacherSubjectIds
  const visibleSubjects = useMemo(() => {
    if (!subjects) return null
    if (!teacherSubjectIds?.length) return subjects
    const normalizedIds = teacherSubjectIds.map((id) => id.toLowerCase())
    return subjects.filter((subject) => normalizedIds.includes(subject.id.toLowerCase()))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjects, teacherSubjectIds?.length])

  useEffect(() => {
    if (!visibleSubjects) return
    setForm((current) => ({ ...current, subjectId: current.subjectId || visibleSubjects[0]?.id || '' }))
  }, [visibleSubjects])

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

  const isLoading = visibleSubjects === null || entitlement === null
  const inputClass =
    'rounded-xl border border-panel-border bg-white p-3 text-base text-panel-text shadow-sm outline-none transition-colors focus:border-panel-blue focus:ring-2 focus:ring-panel-blue-soft'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-panel-surface shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-panel-border px-6 py-4">
          <h2 className="text-xl font-semibold text-panel-text">Öğrenci Ekle</h2>
          <button
            type="button"
            aria-label="Kapat"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-panel-text-muted transition-colors hover:bg-panel-surface-soft hover:text-panel-text"
          >
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5">
          {isLoading ? (
            <LoadingState label="Yükleniyor..." />
          ) : (
            <>
              {!entitlement.isActive ? (
                <div className="mb-4 rounded-xl bg-panel-accent-soft px-4 py-3 text-sm text-panel-warm">
                  Panel aboneliğiniz aktif değil, öğrenci ekleyemezsiniz.
                </div>
              ) : (
                <p className="mb-4 rounded-xl bg-panel-surface-soft px-4 py-3 text-sm text-panel-text-muted">
                  Kalan öğrenci hakkınız: <strong className="text-panel-text">{entitlement.remainingSeats}</strong> /{' '}
                  {entitlement.totalSeats}. Eklediğiniz öğrencinin velisinin zaten aktif bir planı varsa hakkınız
                  harcanmaz.
                </p>
              )}

              {error ? (
                <div className="mb-4 rounded-xl bg-panel-accent-soft px-4 py-3 text-sm text-panel-warm">{error}</div>
              ) : null}

              <div className="flex flex-col gap-4">
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-panel-text-muted">Öğrenci Ad Soyad</span>
                  <input
                    name="studentFullName"
                    value={form.studentFullName}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-panel-text-muted">Ders</span>
                  <select
                    name="subjectId"
                    value={form.subjectId}
                    onChange={handleChange}
                    className={`${inputClass} appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="%236f6e78"><path d="M5.5 7.5l4.5 4.5 4.5-4.5" stroke="%236f6e78" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>')] bg-[right_0.75rem_center] bg-no-repeat pr-9`}
                    disabled={!visibleSubjects.length}
                  >
                    {visibleSubjects.length ? null : <option value="">Ders yok</option>}
                    {visibleSubjects.map((subject) => (
                      <option key={subject.id} value={subject.id}>
                        {subject.name}
                      </option>
                    ))}
                  </select>
                  {!visibleSubjects.length && teacherSubjectIds?.length ? (
                    <span className="text-xs text-panel-text-muted">
                      Profilinizde tanımlı ders bulunamadı. Yönetici ile iletişime geçin.
                    </span>
                  ) : null}
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
                          className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors ${
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
                    className={inputClass}
                  />
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-panel-text-muted">Veli Telefon</span>
                  <input
                    name="parentPhone"
                    type="tel"
                    value={form.parentPhone}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </label>
              </div>
            </>
          )}
        </div>

        {isLoading ? null : (
          <div className="border-t border-panel-border px-6 py-4">
            <Button type="submit" disabled={saving || !entitlement.isActive} className="h-11 w-full text-base">
              {saving ? 'Ekleniyor...' : 'Öğrenciyi Ekle'}
            </Button>
          </div>
        )}
      </form>
    </div>
  )
}
