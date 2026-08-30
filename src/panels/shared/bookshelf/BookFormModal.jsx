import { useEffect, useMemo, useState } from 'react'
import { Plus, X } from 'lucide-react'
import Button from '../../ui/Button'
import LoadingState from '../LoadingState'
import ResourceImageField from '../../parent/components/ResourceImageField'
import { authRequest } from '../../../services/authClient'
import {
  createBookshelfBook,
  createBookshelfPublisher,
  getBookshelfStudents,
  updateBookshelfBook,
} from '../../../services/bookshelfService'
import { BOOKSHELF_GRADE_OPTIONS, BOOKSHELF_RESOURCE_TYPES } from './bookshelfConstants'
import StudentPicker from './StudentPicker'

// Kitaplık "Yeni Kitap Ekle" / "Kitabı Düzenle" formu. Kütüphanedeki ResourceBookModal ile
// aynı alanlar (yayın evi, ad, ders, sınıf, tip, görsel, cevap anahtarı) + oluştururken hangi
// çocuk/öğrencilere atanacağı adımı. Kaydedince oluşan/güncellenen kaynağı döndürür.
export default function BookFormModal({ book, onSaved, onClose }) {
  const isEdit = Boolean(book)
  const [subjects, setSubjects] = useState(null)
  const [publishers, setPublishers] = useState(null)
  const [students, setStudents] = useState(null)
  const [loadError, setLoadError] = useState('')

  const [name, setName] = useState(book?.name || '')
  const [subjectId, setSubjectId] = useState(book?.subjectId || '')
  const [grade, setGrade] = useState(book?.grade || '')
  const [type, setType] = useState(book?.type || '')
  const [publisherId, setPublisherId] = useState(book?.publisherId || '')
  const [newPublisherName, setNewPublisherName] = useState('')
  const [addingPublisher, setAddingPublisher] = useState(false)
  const [hasAnswerKey, setHasAnswerKey] = useState(book ? book.hasAnswerKey : true)
  const [imageUrl, setImageUrl] = useState(book?.imageUrl || '')

  const [selectedStudentIds, setSelectedStudentIds] = useState(() => new Set())

  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let ignore = false
    Promise.all([
      authRequest('/api/panel/subjects', { method: 'GET' }),
      authRequest('/api/panel/publishers', { method: 'GET' }),
      getBookshelfStudents(),
    ])
      .then(([subjectsData, publishersData, studentList]) => {
        if (ignore) return
        setSubjects(subjectsData.subjects)
        setPublishers(publishersData.publishers)
        setStudents(studentList)
        // Tek çocuk/öğrenci varsa (ör. tek çocuklu veli, öğrenci hesabı) otomatik seç.
        if (!isEdit && studentList.length === 1) {
          setSelectedStudentIds(new Set([String(studentList[0].id)]))
        }
      })
      .catch((err) => {
        if (!ignore) setLoadError(err.message)
      })
    return () => {
      ignore = true
    }
  }, [isEdit])

  const sortedPublishers = useMemo(
    () =>
      [...(publishers || [])].sort((a, b) =>
        a.name.localeCompare(b.name, 'tr', { sensitivity: 'base' }),
      ),
    [publishers],
  )

  const toggleStudent = (id) => {
    setSelectedStudentIds((current) => {
      const next = new Set(current)
      const key = String(id)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const handleAddPublisher = async () => {
    const trimmed = newPublisherName.trim()
    if (trimmed.length < 2) {
      setError('Yayın evi adı en az 2 karakter olmalı.')
      return
    }
    setAddingPublisher(true)
    setError('')
    try {
      const publisher = await createBookshelfPublisher(trimmed)
      setPublishers((current) => {
        const exists = (current || []).some((item) => item.id === publisher.id)
        return exists ? current : [...(current || []), publisher]
      })
      setPublisherId(publisher.id)
      setNewPublisherName('')
    } catch (err) {
      setError(err.message)
    } finally {
      setAddingPublisher(false)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (name.trim().length < 2) return setError('Kaynak adı en az 2 karakter olmalı.')
    if (!subjectId) return setError('Ders seçilmeli.')
    if (!grade) return setError('Sınıf seçilmeli.')
    if (!type) return setError('Kaynak tipi seçilmeli.')
    if (!publisherId && newPublisherName.trim().length < 2) return setError('Yayın evi seçilmeli.')
    if (!isEdit && selectedStudentIds.size === 0) {
      return setError('En az bir çocuk/öğrenci seçilmeli.')
    }

    setError('')
    setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        subjectId,
        grade,
        type,
        hasAnswerKey: type === 'soru_bankasi' ? hasAnswerKey : true,
        imageUrl: imageUrl.trim() || null,
        ...(publisherId ? { publisherId } : { newPublisherName: newPublisherName.trim() }),
      }
      const saved = isEdit
        ? await updateBookshelfBook(book.id, payload)
        : await createBookshelfBook({ ...payload, studentIds: [...selectedStudentIds] })
      onSaved(saved)
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
        className="h-full w-full overflow-y-auto border border-panel-border bg-panel-surface p-4 shadow-panel-1 sm:h-auto sm:max-h-[92vh] sm:max-w-2xl sm:rounded-2xl sm:p-6"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-panel-text">{isEdit ? 'Kitabı Düzenle' : 'Yeni Kitap Ekle'}</h2>
            <p className="mt-0.5 text-sm text-panel-text-muted">
              Bu kaynak yalnızca seçtiğiniz çocuk/öğrencilerin kitaplığında görünür; sistem kütüphanesine eklenmez.
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

        {subjects === null || publishers === null || students === null ? (
          <LoadingState label="Form yükleniyor..." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-[200px_1fr] sm:gap-5">
            <div className="flex justify-center sm:justify-start">
              <ResourceImageField value={imageUrl} onChange={setImageUrl} compact size={200} showUrlToggle />
            </div>

            <div className="flex flex-col gap-3">
              {!isEdit && students.length > 1 ? (
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-panel-text-muted">Kime eklensin?</span>
                  <StudentPicker
                    students={students}
                    selectedIds={selectedStudentIds}
                    onToggle={toggleStudent}
                  />
                </div>
              ) : null}

              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-panel-text-muted">Kitap Adı</span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="rounded-xl border border-panel-border p-2.5 text-base text-panel-text"
                />
              </label>

              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-panel-text-muted">Yayın Evi</span>
                <select
                  value={publisherId}
                  onChange={(event) => setPublisherId(event.target.value)}
                  className="rounded-xl border border-panel-border p-2.5 text-base text-panel-text"
                >
                  <option value="">Yayın evi seçin</option>
                  {sortedPublishers.map((publisher) => (
                    <option key={publisher.id} value={publisher.id}>
                      {publisher.name}
                    </option>
                  ))}
                </select>
                {!publisherId ? (
                  <div className="flex items-center gap-2">
                    <input
                      value={newPublisherName}
                      onChange={(event) => setNewPublisherName(event.target.value)}
                      placeholder="veya yeni yayın evi adı yazın"
                      className="flex-1 rounded-xl border border-panel-border p-2 text-sm text-panel-text"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={addingPublisher || newPublisherName.trim().length < 2}
                      onClick={handleAddPublisher}
                      className="gap-1"
                    >
                      <Plus size={14} aria-hidden="true" />
                      Ekle
                    </Button>
                  </div>
                ) : null}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-panel-text-muted">Ders</span>
                  <select
                    value={subjectId}
                    onChange={(event) => setSubjectId(event.target.value)}
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

                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-panel-text-muted">Sınıf</span>
                  <select
                    value={grade}
                    onChange={(event) => setGrade(event.target.value)}
                    className="rounded-xl border border-panel-border p-2.5 text-base text-panel-text"
                  >
                    <option value="">Sınıf seçin</option>
                    {BOOKSHELF_GRADE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}. Sınıf
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-panel-text-muted">Kaynak Tipi</span>
                <select
                  value={type}
                  onChange={(event) => setType(event.target.value)}
                  className="rounded-xl border border-panel-border p-2.5 text-base text-panel-text"
                >
                  <option value="">Tip seçin</option>
                  {BOOKSHELF_RESOURCE_TYPES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              {type === 'soru_bankasi' ? (
                <label className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={hasAnswerKey}
                    onChange={(event) => setHasAnswerKey(event.target.checked)}
                    className="h-4 w-4"
                  />
                  <span className="text-sm font-medium text-panel-text">Cevap Anahtarı Var</span>
                </label>
              ) : null}
            </div>
          </div>
        )}

        <Button
          type="submit"
          disabled={saving || subjects === null || publishers === null || students === null}
          size="md"
          className="mt-5 w-full"
        >
          {saving ? 'Kaydediliyor...' : isEdit ? 'Kaydet' : 'Kitabı Oluştur'}
        </Button>
      </form>
    </div>
  )
}
