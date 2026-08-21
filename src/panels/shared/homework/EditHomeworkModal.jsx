import { useEffect, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { authRequest } from '../../../services/authClient'
import ResourceBookSelect from './ResourceBookSelect'

export default function EditHomeworkModal({ homework, onSave, onClose }) {
  const [subjectId, setSubjectId] = useState(homework.subjectId || '')
  const [resourceBookId, setResourceBookId] = useState(homework.resourceBookId || '')
  const [title, setTitle] = useState(homework.title || '')
  const [totalQuestionCount, setTotalQuestionCount] = useState(homework.totalQuestionCount || 0)
  const [completedQuestionCount, setCompletedQuestionCount] = useState(homework.completedQuestionCount || 0)
  const [totalPageCount, setTotalPageCount] = useState(homework.totalPageCount || 0)
  const [subjects, setSubjects] = useState(null)
  const [subjectsError, setSubjectsError] = useState('')
  const [resourceBooks, setResourceBooks] = useState(null)
  const [resourceBooksError, setResourceBooksError] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let ignore = false

    authRequest('/api/panel/subjects', { method: 'GET' })
      .then((data) => {
        if (!ignore) setSubjects(data.subjects)
      })
      .catch((err) => {
        if (!ignore) setSubjectsError(err.message)
      })

    return () => {
      ignore = true
    }
  }, [])

  useEffect(() => {
    if (!subjectId) return undefined

    let ignore = false
    setResourceBooks(null)
    setResourceBooksError('')

    authRequest(`/api/panel/resource-books?subjectId=${subjectId}`, { method: 'GET' })
      .then((data) => {
        if (!ignore) setResourceBooks(data.resourceBooks)
      })
      .catch((err) => {
        if (!ignore) setResourceBooksError(err.message)
      })

    return () => {
      ignore = true
    }
  }, [subjectId])

  const resourceBookType = resourceBooks?.find((book) => book.id === resourceBookId)?.type
  const isReadingBook = resourceBookType ? resourceBookType === 'okuma_kitabi' : homework.resourceType === 'okuma_kitabi'

  const handleSubjectChange = (event) => {
    const nextSubjectId = event.target.value
    setSubjectId(nextSubjectId)
    setResourceBookId(nextSubjectId === homework.subjectId ? homework.resourceBookId || '' : '')
    setResourceBooks(null)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (saving) return
    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      setError('Ödev notu boş olamaz.')
      return
    }
    if (!resourceBookId) {
      setError('Ödev için öğrenciye atanmış bir kaynak seçmelisiniz.')
      return
    }

    setSaving(true)
    setError('')
    try {
      const updates = {
        title: trimmedTitle,
        subjectId,
        resourceBookId,
      }
      if (isReadingBook) {
        updates.totalPageCount = Number(totalPageCount) || 0
      } else {
        updates.totalQuestionCount = Number(totalQuestionCount) || 0
        updates.completedQuestionCount = Number(completedQuestionCount) || 0
      }
      await onSave(updates)
    } catch (err) {
      setError(err.message || 'Bir hata oluştu, tekrar deneyin.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/30 p-0 sm:items-center sm:p-4">
      <form
        onSubmit={handleSubmit}
        className="h-full w-full max-w-md overflow-y-auto border border-panel-border bg-panel-surface p-4 shadow-panel-1 sm:h-auto sm:max-h-[90vh] sm:rounded-2xl sm:p-6"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-panel-text">Ödevi Düzenle</h2>
          <button type="button" aria-label="Kapat" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-panel-text-muted">Ders</span>
            <select
              required
              value={subjectId}
              onChange={handleSubjectChange}
              disabled={!subjects?.length}
              className="rounded-xl border border-panel-border p-3 text-sm text-panel-text"
            >
              <option value="" disabled>
                {subjects === null ? 'Dersler yükleniyor...' : 'Ders seçin'}
              </option>
              {subjects?.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            {subjectsError ? <span className="text-xs text-panel-warm">{subjectsError}</span> : null}
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-panel-text-muted">Kaynak</span>
            <ResourceBookSelect
              resourceBooks={resourceBooks}
              value={resourceBookId}
              onChange={setResourceBookId}
              disabled={!subjectId || !resourceBooks?.length}
              variant="panel"
              placeholder={
                !subjectId
                  ? 'Önce ders seçin'
                  : resourceBooks === null
                    ? 'Kaynaklar yükleniyor...'
                    : resourceBooks.length === 0
                      ? 'Bu derse atanmış kaynak yok'
                      : 'Kaynak seçin'
              }
            />
            {resourceBooksError ? <span className="text-xs text-panel-warm">{resourceBooksError}</span> : null}
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-panel-text-muted">Ödev Notu</span>
            <textarea
              required
              rows={3}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="rounded-xl border border-panel-border p-3 text-sm text-panel-text"
            />
          </label>

          {isReadingBook ? (
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-panel-text-muted">Sayfa Sayısı</span>
              <input
                type="number"
                min="0"
                value={totalPageCount}
                onChange={(event) => setTotalPageCount(event.target.value)}
                className="rounded-xl border border-panel-border p-3 text-sm text-panel-text"
              />
            </label>
          ) : (
            <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-panel-text-muted">Toplam soru sayısı</span>
                <input
                  type="number"
                  min="0"
                  value={totalQuestionCount}
                  onChange={(event) => setTotalQuestionCount(event.target.value)}
                  className="rounded-xl border border-panel-border p-3 text-sm text-panel-text"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-panel-text-muted">Tamamlanan soru sayısı</span>
                <input
                  type="number"
                  min="0"
                  value={completedQuestionCount}
                  onChange={(event) => setCompletedQuestionCount(event.target.value)}
                  className="rounded-xl border border-panel-border p-3 text-sm text-panel-text"
                />
              </label>
            </div>
          )}

          {error ? <span className="text-xs text-panel-warm">{error}</span> : null}

          <button
            type="submit"
            disabled={saving || !resourceBookId}
            className="flex items-center justify-center gap-2 rounded-xl bg-panel-warm px-4 py-3 text-sm font-semibold text-white hover:bg-panel-warm/90 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : null}
            {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </form>
    </div>
  )
}
