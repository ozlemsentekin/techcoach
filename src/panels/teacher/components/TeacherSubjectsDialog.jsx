import { useEffect, useState } from 'react'
import { Check, GraduationCap, Loader2, X } from 'lucide-react'
import { useAuth } from '../../../context/useAuth'
import { authRequest } from '../../../services/authClient'
import { updateTeacherSubjects } from '../../../services/teacherService'
import SubjectPicker from '../../parent/components/SubjectPicker'

export default function TeacherSubjectsDialog({ onClose }) {
  const { authUser, refreshSession } = useAuth()
  const [allSubjects, setAllSubjects] = useState(null)
  const [subjectIds, setSubjectIds] = useState(authUser?.teacherSubjectIds || [])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    let ignore = false
    authRequest('/api/panel/subjects', { method: 'GET' })
      .then((data) => {
        if (ignore) return
        // Branş id'leri backend'de her zaman küçük harfle saklanır (normalizeTeacherSubjectIds);
        // burada da küçük harfe çevirmezsek, kaydedilmiş seçim SubjectPicker'da eşleşmez.
        setAllSubjects((data.subjects || []).map((subject) => ({ ...subject, id: subject.id.toLowerCase() })))
      })
      .catch((err) => { if (!ignore) setError(err.message) })
    return () => { ignore = true }
  }, [])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setSaving(true)
    try {
      await updateTeacherSubjects(subjectIds)
      await refreshSession()
      setSuccess(true)
    } catch (err) {
      setError(err.message || 'Branşlar kaydedilemedi, tekrar deneyin.')
    } finally {
      setSaving(false)
    }
  }

  if (success) {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center overflow-hidden bg-black/30 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true">
        <div className="w-full min-w-0 max-w-full overflow-x-hidden rounded-t-3xl border border-panel-border bg-panel-surface p-5 shadow-lg sm:max-w-sm sm:rounded-2xl sm:p-6">
          <div className="flex items-center gap-2 text-emerald-600">
            <Check size={20} aria-hidden="true" />
            <h2 className="text-lg font-semibold text-panel-text">Branşlar güncellendi</h2>
          </div>
          <p className="mt-3 break-words text-base text-panel-text-muted">
            Kütüphane sekmelerinde artık sadece seçtiğin branşların dersleri görünecek.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="mt-6 w-full rounded-xl bg-panel-blue px-4 py-3 text-base font-medium text-white"
          >
            Tamam
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-hidden bg-black/30 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <form
        onSubmit={handleSubmit}
        className="w-full min-w-0 max-w-full overflow-x-hidden rounded-t-3xl border border-panel-border bg-panel-surface p-5 shadow-lg sm:max-w-lg sm:rounded-2xl sm:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-panel-blue-soft text-panel-blue">
              <GraduationCap size={18} aria-hidden="true" />
            </span>
            <h2 className="text-lg font-semibold text-panel-text">Branşlarım</h2>
          </div>
          <button type="button" aria-label="Kapat" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <p className="mt-3 text-sm text-panel-text-muted">
          Seçtiğin branşlara göre kütüphanede sadece ilgili ders sekmeleri görünür.
        </p>

        <div className="mt-4">
          {allSubjects === null ? (
            <p className="text-sm text-panel-text-muted">Dersler yükleniyor...</p>
          ) : (
            <SubjectPicker
              allSubjects={allSubjects}
              selectedIds={subjectIds}
              onChange={setSubjectIds}
              allLabel="Tüm Dersler"
              selectedLabel="Branşlarım"
            />
          )}
        </div>

        {error ? <p className="mt-3 text-sm text-panel-warm">{error}</p> : null}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 rounded-xl border border-panel-border px-4 py-3 text-base font-medium text-panel-text disabled:opacity-60"
          >
            Vazgeç
          </button>
          <button
            type="submit"
            disabled={saving || allSubjects === null}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-panel-blue px-4 py-3 text-base font-medium text-white disabled:opacity-70"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : null}
            {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </form>
    </div>
  )
}
