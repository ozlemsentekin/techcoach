import { useEffect, useMemo, useState } from 'react'
import { MotionDiv } from '../../ui/motion'
import { BookOpen, ChevronDown, ChevronRight, Pencil, X } from 'lucide-react'
import { authRequest } from '../../../services/authClient'
import PageHeader from '../../layout/PageHeader'
import LoadingState from '../../shared/LoadingState'
import EmptyState from '../../shared/EmptyState'
import Button from '../../ui/Button'
import DataTable from '../../ui/DataTable'

const RESOURCE_BOOK_TYPES = [
  { value: 'konu_anlatimi', label: 'Konu Anlatımı' },
  { value: 'soru_bankasi', label: 'Soru Bankası' },
  { value: 'okuma_kitabi', label: 'Okuma Kitabı' },
]

function ResourceBookModal({ subject, book, publishers, onSaved, onClose }) {
  const isEdit = Boolean(book)
  const effectiveSubjectId = book?.subjectId || subject?.id
  const [name, setName] = useState(book?.name || '')
  const [pageCount, setPageCount] = useState(book ? String(book.pageCount) : '')
  const [publisherId, setPublisherId] = useState(book?.publisherId || '')
  const [type, setType] = useState(book?.type || '')
  const [isActive, setIsActive] = useState(book ? book.isActive : true)
  const [hasAnswerKey, setHasAnswerKey] = useState(book ? book.hasAnswerKey : true)
  const [imageUrl, setImageUrl] = useState(book?.imageUrl || '')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!publisherId) {
      setError('Yayın evi seçilmeli.')
      return
    }
    if (name.trim().length < 2) {
      setError('Kaynak kitap adı en az 2 karakter olmalı.')
      return
    }
    const pageCountNumber = Number(pageCount)
    if (!Number.isInteger(pageCountNumber) || pageCountNumber <= 0) {
      setError('Sayfa sayısı pozitif bir tam sayı olmalı.')
      return
    }
    if (!type) {
      setError('Kaynak tipi seçilmeli.')
      return
    }

    setError('')
    setLoading(true)
    try {
      const payload = {
        publisherId,
        subjectId: effectiveSubjectId,
        name: name.trim(),
        pageCount: pageCountNumber,
        isActive,
        type,
        hasAnswerKey: type === 'soru_bankasi' ? hasAnswerKey : true,
        imageUrl: imageUrl.trim() || null,
      }
      const data = isEdit
        ? await authRequest(`/api/panel-admin/resource-books/${book.id}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
          })
        : await authRequest('/api/panel-admin/resource-books', {
            method: 'POST',
            body: JSON.stringify(payload),
          })
      onSaved(data.resourceBook)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-md panel-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-panel-text">{isEdit ? 'Kaynağı Düzenle' : 'Kaynak Ekle'}</h2>
          <button type="button" aria-label="Kapat" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {subject ? (
          <p className="mb-3 text-sm text-panel-text-muted">
            Ders: <span className="font-medium text-panel-text">{subject.name}</span>
          </p>
        ) : null}

        {error ? (
          <div className="mb-3 rounded-xl bg-panel-accent-soft px-3 py-2.5 text-sm text-panel-warm">{error}</div>
        ) : null}

        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-panel-text-muted">Yayın Evi</span>
            <select
              value={publisherId}
              onChange={(event) => setPublisherId(event.target.value)}
              className="rounded-xl border border-panel-border p-2.5 text-base text-panel-text"
            >
              <option value="" disabled>
                Yayın evi seçin
              </option>
              {publishers?.map((publisher) => (
                <option key={publisher.id} value={publisher.id}>
                  {publisher.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-panel-text-muted">Kitap Adı</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="rounded-xl border border-panel-border p-2.5 text-base text-panel-text"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-panel-text-muted">Tip</span>
            <select
              value={type}
              onChange={(event) => setType(event.target.value)}
              className="rounded-xl border border-panel-border p-2.5 text-base text-panel-text"
            >
              <option value="" disabled>
                Tip seçin
              </option>
              {RESOURCE_BOOK_TYPES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-panel-text-muted">Sayfa Sayısı</span>
            <input
              type="number"
              min="1"
              value={pageCount}
              onChange={(event) => setPageCount(event.target.value)}
              className="rounded-xl border border-panel-border p-2.5 text-base text-panel-text"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-panel-text-muted">Kapak / Profil Görseli URL</span>
            <input
              value={imageUrl}
              onChange={(event) => setImageUrl(event.target.value)}
              placeholder="https://..."
              className="rounded-xl border border-panel-border p-2.5 text-base text-panel-text"
            />
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

          <label className="flex items-center gap-2.5">
            <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} className="h-4 w-4" />
            <span className="text-sm font-medium text-panel-text">Aktif</span>
          </label>

          <Button type="submit" disabled={loading} size="md" className="w-full">
            {loading ? 'Kaydediliyor...' : isEdit ? 'Kaydet' : 'Kaynak Oluştur'}
          </Button>
        </div>
      </form>
    </div>
  )
}

function BookRow({ book, publishersById, onEditBook, onToggleActive }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#edf0f1] px-4 py-2.5">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {book.imageUrl ? (
          <img src={book.imageUrl} alt={`${book.name} görseli`} className="h-8 w-8 rounded-lg object-cover" />
        ) : null}
        <span className="truncate text-sm font-medium text-[#253d3e]">{book.name}</span>
        <button
          type="button"
          aria-label="Kaynağı düzenle"
          className="text-[#87a3a5] hover:text-[#253d3e]"
          onClick={() => onEditBook(book)}
        >
          <Pencil size={13} aria-hidden="true" />
        </button>
        <span className="text-xs text-[#667475]">{publishersById[book.publisherId]?.name || '—'}</span>
        <span className="text-xs text-[#667475]">· {book.pageCount} sayfa</span>
      </div>
      <button
        type="button"
        onClick={() => onToggleActive(book)}
        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
          book.isActive ? 'bg-[#e8f3ee] text-[#2f7a57]' : 'bg-[#f1f1f3] text-[#8a8a92]'
        }`}
      >
        {book.isActive ? 'Aktif' : 'Pasif'}
      </button>
    </div>
  )
}

function SubjectRow({ subject, books, publishersById, onToggleActive, onEditBook, onAddBook }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div>
      <div
        className="flex flex-wrap items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[#f8f7fb] sm:grid sm:grid-cols-[minmax(0,1fr)_140px_180px] sm:items-center sm:gap-3"
        onClick={() => setExpanded((value) => !value)}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          {expanded ? (
            <ChevronDown size={15} className="shrink-0 text-[#87a3a5]" aria-hidden="true" />
          ) : (
            <ChevronRight size={15} className="shrink-0 text-[#87a3a5]" aria-hidden="true" />
          )}
          <BookOpen size={16} className="shrink-0 text-[#253d3e]" aria-hidden="true" />
          <span className="truncate text-sm font-semibold text-[#253d3e]">{subject.name}</span>
        </div>
        <div>
          <span className="inline-flex items-center rounded-full bg-[#f8f7fb] px-2.5 py-1 text-xs font-medium text-[#655e94]">
            {books.length} kaynak
          </span>
        </div>
        <div className="flex items-center justify-start gap-2 sm:justify-end" onClick={(event) => event.stopPropagation()}>
          <Button
            variant="secondary"
            size="sm"
            className="h-[34px] rounded-[9px] border-[#dfe4e5] bg-white text-[#253d3e] hover:bg-[#f8f7fb]"
            onClick={() => onAddBook(subject)}
          >
            + Kaynak Ekle
          </Button>
        </div>
      </div>
      {expanded ? (
        <div className="border-t border-[#edf0f1] bg-white">
          {books.length === 0 ? (
            <p className="px-4 py-3 text-xs text-[#667475]">Bu derse ait kaynak yok.</p>
          ) : (
            books.map((book) => (
              <BookRow key={book.id} book={book} publishersById={publishersById} onEditBook={onEditBook} onToggleActive={onToggleActive} />
            ))
          )}
        </div>
      ) : null}
    </div>
  )
}

export default function AdminSubjectsPage() {
  const [subjects, setSubjects] = useState(null)
  const [resourceBooks, setResourceBooks] = useState(null)
  const [publishers, setPublishers] = useState(null)
  const [error, setError] = useState('')
  const [addBookSubject, setAddBookSubject] = useState(null)
  const [editingBook, setEditingBook] = useState(null)

  const loadData = () => {
    Promise.all([
      authRequest('/api/panel-admin/subjects', { method: 'GET' }),
      authRequest('/api/panel-admin/resource-books', { method: 'GET' }),
      authRequest('/api/panel-admin/publishers', { method: 'GET' }),
    ])
      .then(([subjectsData, booksData, publishersData]) => {
        setSubjects(subjectsData.subjects)
        setResourceBooks(booksData.resourceBooks)
        setPublishers(publishersData.publishers)
      })
      .catch((err) => setError(err.message))
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleBookSaved = (book) => {
    setResourceBooks((current) => {
      const exists = (current || []).some((item) => item.id === book.id)
      return exists ? current.map((item) => (item.id === book.id ? book : item)) : [...(current || []), book]
    })
    setAddBookSubject(null)
    setEditingBook(null)
  }

  const handleToggleActive = async (book) => {
    try {
      const data = await authRequest(`/api/panel-admin/resource-books/${book.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          publisherId: book.publisherId,
          subjectId: book.subjectId,
          name: book.name,
          pageCount: book.pageCount,
          isActive: !book.isActive,
          type: book.type,
          hasAnswerKey: book.hasAnswerKey,
          imageUrl: book.imageUrl,
        }),
      })
      handleBookSaved(data.resourceBook)
    } catch (err) {
      setError(err.message)
    }
  }

  const publishersById = useMemo(
    () => Object.fromEntries((publishers || []).map((publisher) => [publisher.id, publisher])),
    [publishers],
  )

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Dersler" />

      {error ? (
        <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-base text-panel-warm">{error}</div>
      ) : subjects === null || resourceBooks === null || publishers === null ? (
        <LoadingState label="Dersler yükleniyor..." />
      ) : subjects.length === 0 ? (
        <EmptyState icon={BookOpen} title="Henüz ders yok" />
      ) : (
        <MotionDiv initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <DataTable>
            <div className="hidden items-center gap-3 bg-[#f8f7fb] px-4 py-3 text-[13px] font-semibold text-[#655e94] sm:grid sm:grid-cols-[minmax(0,1fr)_140px_180px]">
              <span>Ders Adı</span>
              <span>Kaynak</span>
              <span>İşlem</span>
            </div>
            <div className="divide-y divide-[#edf0f1]">
              {subjects.map((subject) => (
                <SubjectRow
                  key={subject.id}
                  subject={subject}
                  books={resourceBooks.filter((book) => book.subjectId === subject.id)}
                  publishersById={publishersById}
                  onToggleActive={handleToggleActive}
                  onEditBook={setEditingBook}
                  onAddBook={setAddBookSubject}
                />
              ))}
            </div>
          </DataTable>
        </MotionDiv>
      )}

      {addBookSubject ? (
        <ResourceBookModal
          subject={addBookSubject}
          publishers={publishers}
          onSaved={handleBookSaved}
          onClose={() => setAddBookSubject(null)}
        />
      ) : null}

      {editingBook ? (
        <ResourceBookModal
          book={editingBook}
          subject={subjects?.find((subject) => subject.id === editingBook.subjectId)}
          publishers={publishers}
          onSaved={handleBookSaved}
          onClose={() => setEditingBook(null)}
        />
      ) : null}
    </div>
  )
}
