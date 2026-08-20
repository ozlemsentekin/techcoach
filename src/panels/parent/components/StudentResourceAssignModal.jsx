import { useEffect, useMemo, useState } from 'react'
import { BookOpen, Check, Search, X } from 'lucide-react'
import { authRequest } from '../../../services/authClient'
import LoadingState from '../../shared/LoadingState'
import EmptyState from '../../shared/EmptyState'
import Button from '../../ui/Button'

const RESOURCE_BOOK_TYPE_LABELS = {
  konu_anlatimi: 'Konu Anlatımı',
  soru_bankasi: 'Soru Bankası',
  okuma_kitabi: 'Okuma Kitabı',
}

function groupResourceBooksBySubject(resourceBooks) {
  const groups = new Map()

  resourceBooks.forEach((book) => {
    const key = book.subjectId || 'no-subject'
    if (!groups.has(key)) {
      groups.set(key, {
        id: key,
        name: book.subjectName || 'Derssiz Kaynaklar',
        books: [],
      })
    }
    groups.get(key).books.push(book)
  })

  return Array.from(groups.values())
}

function ResourceAvatar({ book }) {
  if (book.imageUrl) {
    return (
      <img
        src={book.imageUrl}
        alt={`${book.name} görseli`}
        className="h-14 w-14 shrink-0 rounded-xl border border-panel-border object-cover"
      />
    )
  }

  return (
    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#fbe9d7] text-[#c96a1f]">
      <BookOpen size={22} aria-hidden="true" />
    </span>
  )
}

export default function StudentResourceAssignModal({ student, onSaved, onClose }) {
  const [resourceBooks, setResourceBooks] = useState(null)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [activeSubjectId, setActiveSubjectId] = useState(null)
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let ignore = false

    authRequest(`/api/parent/students/${student.id}/resource-books`, { method: 'GET' })
      .then((data) => {
        if (!ignore) setResourceBooks(data.resourceBooks)
      })
      .catch((err) => {
        if (!ignore) setError(err.message)
      })

    return () => {
      ignore = true
    }
  }, [student.id])

  const assignedIds = useMemo(
    () => (resourceBooks || []).filter((book) => book.assigned).map((book) => book.id),
    [resourceBooks],
  )

  const unassignedBooks = (resourceBooks || []).filter((book) => !book.assigned)

  const filteredBooks = unassignedBooks.filter((book) => {
    const normalizedQuery = query.trim().toLocaleLowerCase('tr-TR')
    if (!normalizedQuery) return true

    return [book.name, book.publisherName, book.subjectName]
      .filter(Boolean)
      .some((value) => value.toLocaleLowerCase('tr-TR').includes(normalizedQuery))
  })

  const subjectGroups = groupResourceBooksBySubject(filteredBooks)

  useEffect(() => {
    if (activeSubjectId && subjectGroups.some((group) => group.id === activeSubjectId)) return
    setActiveSubjectId(subjectGroups[0]?.id || null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectGroups.map((group) => group.id).join(',')])

  const activeSubject = subjectGroups.find((group) => group.id === activeSubjectId) || null

  const toggleResource = (bookId) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(bookId)) next.delete(bookId)
      else next.add(bookId)
      return next
    })
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      const data = await authRequest(`/api/parent/students/${student.id}/resource-books`, {
        method: 'PUT',
        body: JSON.stringify({ resourceBookIds: [...assignedIds, ...selectedIds] }),
      })
      onSaved(student.id, data.resourceCount, data.resourceBooks)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-stretch justify-center bg-black/30 p-0 sm:items-center sm:p-4">
      <div className="flex h-full w-full max-w-5xl flex-col overflow-hidden border border-panel-border bg-panel-surface p-4 shadow-panel-1 sm:h-[88vh] sm:max-h-[92vh] sm:rounded-2xl sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-panel-text">Kaynak Ata</h2>
            <p className="text-xs text-panel-text-muted">{student.fullName}</p>
          </div>
          <button type="button" aria-label="Kapat" onClick={onClose} className="shrink-0">
            <X size={20} />
          </button>
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="relative w-full sm:w-72">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-panel-text-muted"
              aria-hidden="true"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Kaynak, yayın evi veya ders ara..."
              className="w-full rounded-xl border border-panel-border bg-white py-2 pl-9 pr-3 text-sm text-panel-text focus:outline-none focus:ring-2 focus:ring-[#1c2b5e]/20"
            />
          </div>
          <span className="rounded-full bg-[#fbe9d7] px-3 py-1 text-xs font-semibold text-[#c96a1f]">
            {selectedIds.size} kaynak seçili
          </span>
        </div>

        {subjectGroups.length > 1 ? (
          <div className="mb-4 flex gap-1 overflow-x-auto border-b border-panel-border">
            {subjectGroups.map((subject) => (
              <button
                key={subject.id}
                type="button"
                onClick={() => setActiveSubjectId(subject.id)}
                className={`shrink-0 whitespace-nowrap border-b-2 px-3 pb-2.5 text-sm font-semibold transition-colors ${
                  activeSubjectId === subject.id
                    ? 'border-panel-blue text-panel-blue'
                    : 'border-transparent text-panel-text-muted hover:text-panel-text'
                }`}
              >
                {subject.name}
                <span className="ml-1.5 text-xs font-medium text-panel-text-muted">({subject.books.length})</span>
              </button>
            ))}
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto">
          {error ? (
            <div className="mb-4 rounded-xl bg-panel-accent-soft px-4 py-3 text-sm text-panel-warm">{error}</div>
          ) : null}

          {resourceBooks === null ? (
            <LoadingState label="Kaynaklar yükleniyor..." />
          ) : unassignedBooks.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="Atanacak kaynak yok"
              description="Bu öğrenciye tüm kaynaklar zaten atanmış."
            />
          ) : subjectGroups.length === 0 ? (
            <p className="p-2 text-sm text-panel-text-muted">Aramayla eşleşen kaynak yok.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {(activeSubject?.books || []).map((book) => {
                const selected = selectedIds.has(book.id)
                return (
                  <button
                    key={book.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleResource(book.id)}
                    className={`flex min-h-[118px] items-start gap-3 rounded-xl border p-3 text-left transition-colors ${
                      selected
                        ? 'border-[#1c2b5e] bg-[#f8f7fb] shadow-[0_2px_10px_rgba(101,94,148,0.12)]'
                        : 'border-panel-border bg-white hover:border-[#c1c8e0] hover:bg-[#f7f8fc]'
                    }`}
                  >
                    <ResourceAvatar book={book} />
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="flex items-start justify-between gap-2">
                        <span className="line-clamp-2 text-sm font-bold leading-snug text-panel-text">{book.name}</span>
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                            selected ? 'border-[#1c2b5e] bg-[#1c2b5e] text-white' : 'border-panel-border bg-white'
                          }`}
                        >
                          {selected ? <Check size={13} aria-hidden="true" /> : null}
                        </span>
                      </span>
                      <span className="truncate text-xs text-panel-text-muted">{book.publisherName || 'Yayın evi yok'}</span>
                      <span className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-[#1c2b5e]">
                          {RESOURCE_BOOK_TYPE_LABELS[book.type] || book.type}
                        </span>
                        <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-panel-text-muted">
                          {book.pageCount} sayfa
                        </span>
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-col items-stretch gap-2 border-t border-panel-border pt-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" size="md" onClick={onClose} disabled={saving}>
            Vazgeç
          </Button>
          <Button type="button" size="md" onClick={handleSave} disabled={saving || selectedIds.size === 0}>
            {saving ? 'Ekleniyor...' : 'Seçilenleri Ekle'}
          </Button>
        </div>
      </div>
    </div>
  )
}
