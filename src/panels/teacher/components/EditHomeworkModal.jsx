import { useEffect, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import ResourceBookSelect from '../../shared/homework/ResourceBookSelect'
import { getTeacherResourceBooks } from '../../../services/teacherService'

export default function EditHomeworkModal({ studentTeacherId, homework, onSave, onClose }) {
  const [resourceBookId, setResourceBookId] = useState(homework.resourceBookId || '')
  const [title, setTitle] = useState(homework.title || '')
  const [totalQuestionCount, setTotalQuestionCount] = useState(homework.totalQuestionCount || 0)
  const [totalPageCount, setTotalPageCount] = useState(homework.totalPageCount || 0)
  const [resourceBooks, setResourceBooks] = useState(null)
  const [resourceBooksError, setResourceBooksError] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let ignore = false

    getTeacherResourceBooks(studentTeacherId)
      .then((data) => {
        if (!ignore) setResourceBooks(data)
      })
      .catch((err) => {
        if (!ignore) setResourceBooksError(err.message)
      })

    return () => {
      ignore = true
    }
  }, [studentTeacherId])

  const resourceBookType = resourceBooks?.find((book) => book.id === resourceBookId)?.type
  const isReadingBook = resourceBookType ? resourceBookType === 'okuma_kitabi' : homework.resourceType === 'okuma_kitabi'

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (saving) return
    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      setError('Ödev notu boş olamaz.')
      return
    }
    if (!resourceBookId) {
      setError('Ödev için takip ettiğiniz bir kaynak seçmelisiniz.')
      return
    }

    setSaving(true)
    setError('')
    try {
      const updates = { title: trimmedTitle, resourceBookId }
      if (isReadingBook) {
        updates.totalPageCount = Number(totalPageCount) || 0
      } else {
        updates.totalQuestionCount = Number(totalQuestionCount) || 0
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
            <span className="text-xs font-medium text-panel-text-muted">Kaynak</span>
            <ResourceBookSelect
              resourceBooks={resourceBooks}
              value={resourceBookId}
              onChange={setResourceBookId}
              disabled={!resourceBooks?.length}
              placeholder={resourceBooks === null ? 'Kaynaklar yükleniyor...' : 'Kaynak seçin'}
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
