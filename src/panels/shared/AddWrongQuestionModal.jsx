import { useEffect, useRef, useState } from 'react'
import { Camera, ChevronDown, X } from 'lucide-react'
import { authRequest } from '../../services/authClient'
import { getResourceBooksForStudent } from '../../services/resourceBookService'
import { addWrongQuestion } from '../../services/wrongQuestionService'
import LoadingState from './LoadingState'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import MistakePhotoCaptureModal from '../student/components/MistakePhotoCaptureModal'

// Hata Defteri'nin serbest "+ Hata Ekle" akışı: bir görev/test tamamlamadan, sadece ders zorunlu
// tutularak yeni bir hata kaydı açar. Kitaplıktan bir kitap seçilebilir (herhangi bir content_mode
// — hem yapılandırılmış hem "basit" kitaplar) ya da kitap adı serbestçe yazılabilir; bu, henüz
// Kitaplık'a eklenmemiş bir kaynaktan da hata kaydedebilmeyi sağlar.
export default function AddWrongQuestionModal({ studentId, onClose, onSaved }) {
  const [subjects, setSubjects] = useState(null)
  const [resourceBooks, setResourceBooks] = useState(null)
  const [loadError, setLoadError] = useState('')

  const [subjectId, setSubjectId] = useState('')
  const [bookMode, setBookMode] = useState('pick')
  const [resourceBookId, setResourceBookId] = useState('')
  const [bookDropdownOpen, setBookDropdownOpen] = useState(false)
  const bookDropdownRef = useRef(null)
  const [freeBookName, setFreeBookName] = useState('')
  const [topic, setTopic] = useState('')
  const [studentNote, setStudentNote] = useState('')
  const [photo, setPhoto] = useState('')
  const [showPhotoCapture, setShowPhotoCapture] = useState(false)

  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let ignore = false
    Promise.all([
      authRequest('/api/panel/subjects', { method: 'GET' }),
      getResourceBooksForStudent(studentId),
    ])
      .then(([subjectsData, books]) => {
        if (ignore) return
        setSubjects(subjectsData.subjects)
        setResourceBooks(books)
      })
      .catch((err) => {
        if (!ignore) setLoadError(err.message)
      })
    return () => {
      ignore = true
    }
  }, [studentId])

  const booksForSubject = (resourceBooks || []).filter((book) => !subjectId || book.subjectId === subjectId)
  const selectedBook = (resourceBooks || []).find((book) => book.id === resourceBookId) || null

  useEffect(() => {
    if (!bookDropdownOpen) return undefined
    function handleClickOutside(event) {
      if (bookDropdownRef.current && !bookDropdownRef.current.contains(event.target)) {
        setBookDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [bookDropdownOpen])

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!subjectId) return setError('Ders seçilmeli.')
    if (bookMode === 'pick' && !resourceBookId) return setError('Bir kitap seçin.')
    if (bookMode === 'free' && freeBookName.trim().length < 2) return setError('Kitap adını yazın.')
    if (!photo) return setError('Hata fotoğrafı eklenmeli.')

    const subjectName = subjects?.find((s) => s.id === subjectId)?.name || ''

    setError('')
    setSaving(true)
    try {
      const entry = {
        studentId,
        subject: subjectName,
        topic: topic.trim() || null,
        studentNote: studentNote.trim() || null,
        photo,
        ...(bookMode === 'pick' ? { resourceBookId } : { freeBookName: freeBookName.trim() }),
      }
      const wrongQuestion = await addWrongQuestion(entry)
      onSaved?.(wrongQuestion)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/30 p-0 sm:items-center sm:p-4">
      <form
        onSubmit={handleSubmit}
        className="h-full w-full overflow-y-auto border border-panel-border bg-panel-surface p-4 shadow-panel-1 sm:h-auto sm:max-h-[92vh] sm:max-w-lg sm:rounded-2xl sm:p-6"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-panel-text">Hata Ekle</h2>
            <p className="mt-0.5 text-sm text-panel-text-muted">
              Bir görev tamamlamadan da yanlış yaptığın bir soruyu Hata Defteri'ne ekleyebilirsin.
            </p>
          </div>
          <button type="button" aria-label="Kapat" onClick={onClose} className="shrink-0 text-panel-text-muted hover:text-panel-text">
            <X size={20} />
          </button>
        </div>

        {error ? (
          <div className="mb-3 rounded-xl bg-panel-accent-soft px-3 py-2 text-sm text-panel-warm">{error}</div>
        ) : null}
        {loadError ? (
          <div className="mb-3 rounded-xl bg-panel-accent-soft px-3 py-2 text-sm text-panel-warm">{loadError}</div>
        ) : null}

        {subjects === null || resourceBooks === null ? (
          <LoadingState label="Form yükleniyor..." />
        ) : (
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-panel-text-muted">Ders</span>
              <select
                value={subjectId}
                onChange={(event) => {
                  setSubjectId(event.target.value)
                  setResourceBookId('')
                  setBookDropdownOpen(false)
                }}
                className="rounded-xl border border-panel-border p-2.5 text-base text-panel-text"
              >
                <option value="">Ders seçin</option>
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setBookMode('pick')}
                className={`rounded-xl border p-2.5 text-sm font-medium transition-colors ${
                  bookMode === 'pick'
                    ? 'border-panel-accent bg-panel-accent-soft text-panel-text'
                    : 'border-panel-border text-panel-text-muted'
                }`}
              >
                Kitap seç
              </button>
              <button
                type="button"
                onClick={() => setBookMode('free')}
                className={`rounded-xl border p-2.5 text-sm font-medium transition-colors ${
                  bookMode === 'free'
                    ? 'border-panel-accent bg-panel-accent-soft text-panel-text'
                    : 'border-panel-border text-panel-text-muted'
                }`}
              >
                Serbest yaz
              </button>
            </div>

            {bookMode === 'pick' ? (
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-panel-text-muted">Kitap</span>
                <div className="relative" ref={bookDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setBookDropdownOpen((prev) => !prev)}
                    className="flex w-full items-center justify-between gap-2 rounded-xl border border-panel-border p-2.5 text-left text-base text-panel-text"
                  >
                    {selectedBook ? (
                      <span className="flex min-w-0 flex-1 items-center gap-1.5">
                        {selectedBook.publisherName ? (
                          <Badge tone="lilac" className="shrink-0 px-1.5 py-0 text-[10px] leading-4">
                            {selectedBook.publisherName}
                          </Badge>
                        ) : null}
                        <span className="truncate">{selectedBook.name}</span>
                      </span>
                    ) : (
                      <span className="text-panel-text-muted">Kitap seçin</span>
                    )}
                    <ChevronDown size={16} className="shrink-0 text-panel-text-muted" />
                  </button>

                  {bookDropdownOpen ? (
                    <div className="panel-card absolute z-10 mt-1 max-h-64 w-full overflow-y-auto bg-panel-surface p-1">
                      <button
                        type="button"
                        onClick={() => {
                          setResourceBookId('')
                          setBookDropdownOpen(false)
                        }}
                        className="flex w-full items-center rounded-lg px-2 py-1.5 text-left text-sm text-panel-text-muted hover:bg-panel-surface-soft"
                      >
                        Kitap seçin
                      </button>
                      {booksForSubject.map((book) => (
                        <button
                          key={book.id}
                          type="button"
                          onClick={() => {
                            setResourceBookId(book.id)
                            setBookDropdownOpen(false)
                          }}
                          className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-panel-surface-soft"
                        >
                          {book.publisherName ? (
                            <Badge tone="lilac" className="shrink-0 px-1.5 py-0 text-[10px] leading-4">
                              {book.publisherName}
                            </Badge>
                          ) : null}
                          <span className="truncate text-panel-text">{book.name}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                {subjectId && booksForSubject.length === 0 ? (
                  <span className="text-xs text-panel-text-muted">Bu derste kayıtlı kitap yok, serbest yazabilirsin.</span>
                ) : null}
              </div>
            ) : (
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-panel-text-muted">Kitap Adı</span>
                <input
                  value={freeBookName}
                  onChange={(event) => setFreeBookName(event.target.value)}
                  className="rounded-xl border border-panel-border p-2.5 text-base text-panel-text"
                />
              </label>
            )}

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-panel-text-muted">Konu (isteğe bağlı)</span>
              <input
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                className="rounded-xl border border-panel-border p-2.5 text-base text-panel-text"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-panel-text-muted">Not (isteğe bağlı)</span>
              <textarea
                value={studentNote}
                onChange={(event) => setStudentNote(event.target.value)}
                rows={2}
                className="rounded-xl border border-panel-border p-2.5 text-base text-panel-text"
              />
            </label>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-panel-text-muted">Fotoğraf</span>
              {photo ? (
                <img src={photo} alt="Hata fotoğrafı" className="h-32 w-full rounded-xl border border-panel-border object-contain" />
              ) : null}
              <button
                type="button"
                onClick={() => setShowPhotoCapture(true)}
                className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-panel-border px-4 py-2.5 text-sm font-semibold text-panel-text hover:bg-panel-surface-soft"
              >
                <Camera size={16} aria-hidden="true" />
                {photo ? 'Fotoğrafı Değiştir' : 'Fotoğraf Ekle'}
              </button>
            </div>
          </div>
        )}

        <Button
          type="submit"
          disabled={saving || subjects === null || resourceBooks === null}
          className="mt-5 w-full"
        >
          {saving ? 'Kaydediliyor...' : 'Hatayı Ekle'}
        </Button>
      </form>

      {showPhotoCapture ? (
        <MistakePhotoCaptureModal
          existingPhotoUrl={photo}
          onClose={() => setShowPhotoCapture(false)}
          onSave={async (dataUrl) => setPhoto(dataUrl)}
        />
      ) : null}
    </div>
  )
}
