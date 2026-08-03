import { useEffect, useState } from 'react'
import { BookOpen, Check, Search, X } from 'lucide-react'
import { authRequest } from '../../../services/authClient'
import EmptyState from '../../shared/EmptyState'
import LoadingState from '../../shared/LoadingState'
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
        className="h-14 w-14 shrink-0 rounded-xl border border-[#e5e8e9] object-cover"
      />
    )
  }

  return (
    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#f5f2fb] text-[#655e94]">
      <BookOpen size={22} aria-hidden="true" />
    </span>
  )
}

export default function TeacherResourceBooksModal({ student, teacher, onSaved, onClose }) {
  const [resourceBooks, setResourceBooks] = useState(null)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let ignore = false

    authRequest(`/api/parent/students/${student.id}/teachers/${teacher.id}/resource-books`, { method: 'GET' })
      .then((data) => {
        if (ignore) return
        setResourceBooks(data.resourceBooks)
        setSelectedIds(new Set(data.resourceBooks.filter((book) => book.assigned).map((book) => book.id)))
      })
      .catch((err) => {
        if (!ignore) setError(err.message)
      })

    return () => {
      ignore = true
    }
  }, [student.id, teacher.id])

  const filteredResourceBooks = (resourceBooks || []).filter((book) => {
    const normalizedQuery = query.trim().toLocaleLowerCase('tr-TR')
    if (!normalizedQuery) return true

    return [book.name, book.publisherName, book.subjectName]
      .filter(Boolean)
      .some((value) => value.toLocaleLowerCase('tr-TR').includes(normalizedQuery))
  })

  const subjectGroups = groupResourceBooksBySubject(filteredResourceBooks)

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
      const data = await authRequest(`/api/parent/students/${student.id}/teachers/${teacher.id}/resource-books`, {
        method: 'PUT',
        body: JSON.stringify({ resourceBookIds: Array.from(selectedIds) }),
      })
      onSaved(teacher.id, data.resourceBooks, data.resourceCount)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="flex max-h-[88vh] w-full max-w-5xl flex-col rounded-2xl bg-white shadow-panel-2">
        <div className="flex items-start justify-between gap-4 border-b border-[#edf0f1] px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-panel-text">Takip Edilen Kaynaklar</h2>
            <p className="text-sm text-panel-text-muted">
              {teacher.fullName} · {student.fullName}
            </p>
          </div>
          <button type="button" aria-label="Kapat" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf0f1] px-5 py-3">
          <div className="relative w-full sm:w-80">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#87a3a5]"
              aria-hidden="true"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Kaynak, yayın evi veya ders ara..."
              className="w-full rounded-xl border border-[#dfe4e5] bg-white py-2 pl-9 pr-3 text-sm text-[#253d3e] focus:outline-none focus:ring-2 focus:ring-[#655e94]/20"
            />
          </div>
          <span className="rounded-full bg-[#f5f2fb] px-3 py-1 text-xs font-semibold text-[#655e94]">
            {selectedIds.size} kaynak seçili
          </span>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {error ? (
            <div className="mb-4 rounded-xl bg-panel-accent-soft px-4 py-3 text-sm text-panel-warm">{error}</div>
          ) : null}

          {resourceBooks === null ? (
            <LoadingState label="Kaynaklar yükleniyor..." />
          ) : resourceBooks.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="Öğrenci kaynakları boş"
              description="Öğrenciye kaynak eklendiğinde öğretmenle ilişkilendirilebilir."
            />
          ) : subjectGroups.length === 0 ? (
            <p className="py-8 text-sm text-[#667475]">Aramayla eşleşen kaynak yok.</p>
          ) : (
            <div className="flex flex-col gap-6">
              {subjectGroups.map((group) => (
                <section key={group.id} className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-3 border-b border-[#edf0f1] pb-2">
                    <h3 className="text-sm font-bold text-[#253d3e]">{group.name}</h3>
                    <span className="text-xs font-medium text-[#667475]">{group.books.length} kaynak</span>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {group.books.map((book) => {
                      const selected = selectedIds.has(book.id)
                      return (
                        <button
                          key={book.id}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => toggleResource(book.id)}
                          className={`flex min-h-[118px] items-start gap-3 rounded-xl border p-3 text-left transition-colors ${
                            selected
                              ? 'border-[#655e94] bg-[#f8f7fb] shadow-[0_2px_10px_rgba(101,94,148,0.12)]'
                              : 'border-[#e5e8e9] bg-white hover:border-[#c9bfec] hover:bg-[#fbfaff]'
                          }`}
                        >
                          <ResourceAvatar book={book} />
                          <span className="flex min-w-0 flex-1 flex-col gap-1">
                            <span className="flex items-start justify-between gap-2">
                              <span className="line-clamp-2 text-sm font-bold leading-snug text-[#253d3e]">{book.name}</span>
                              <span
                                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                                  selected ? 'border-[#655e94] bg-[#655e94] text-white' : 'border-[#cfd5d7] bg-white'
                                }`}
                              >
                                {selected ? <Check size={13} aria-hidden="true" /> : null}
                              </span>
                            </span>
                            <span className="truncate text-xs text-[#667475]">{book.publisherName || 'Yayın evi yok'}</span>
                            <span className="flex flex-wrap items-center gap-1.5 pt-1">
                              <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-[#655e94]">
                                {RESOURCE_BOOK_TYPE_LABELS[book.type] || book.type}
                              </span>
                              <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-[#667475]">
                                {book.pageCount} sayfa
                              </span>
                            </span>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-[#edf0f1] px-5 py-4">
          <Button type="button" variant="secondary" size="md" onClick={onClose} disabled={saving}>
            Vazgeç
          </Button>
          <Button type="button" size="md" onClick={handleSave} disabled={saving || resourceBooks === null}>
            {saving ? 'Kaydediliyor...' : 'Kaynakları Kaydet'}
          </Button>
        </div>
      </div>
    </div>
  )
}
