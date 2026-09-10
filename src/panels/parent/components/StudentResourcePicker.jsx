import { useEffect, useMemo, useRef, useState } from 'react'
import { BookOpen, Check, FilePlus2, Search } from 'lucide-react'
import { authRequest } from '../../../services/authClient'
import LoadingState from '../../shared/LoadingState'
import Button from '../../ui/Button'
import BookAdditionRequestModal from '../../shared/requests/BookAdditionRequestModal'

const RESOURCE_BOOK_TYPE_LABELS = {
  konu_anlatimi: 'Konu Anlatımı',
  soru_bankasi: 'Soru Bankası',
  okuma_kitabi: 'Okuma Kitabı',
  etkinlik: 'Etkinlik',
}

function groupBySubject(resourceBooks) {
  const groups = new Map()
  resourceBooks.forEach((book) => {
    const key = book.subjectId || 'no-subject'
    if (!groups.has(key)) {
      groups.set(key, { id: key, name: book.subjectName || 'Derssiz Kaynaklar', books: [] })
    }
    groups.get(key).books.push(book)
  })
  return Array.from(groups.values())
}

function groupByPublisher(resourceBooks) {
  const groups = new Map()
  resourceBooks.forEach((book) => {
    const name = book.publisherName?.trim() || 'Yayınevi belirtilmemiş'
    const key = book.publisherId || name.toLocaleLowerCase('tr-TR')
    if (!groups.has(key)) groups.set(key, { id: key, name, books: [] })
    groups.get(key).books.push(book)
  })
  return Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name, 'tr'))
}

function ResourceAvatar({ book }) {
  if (book.imageUrl) {
    return (
      <img
        loading="lazy"
        decoding="async"
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

/**
 * "Çocuk Ekle" sihirbazının Kaynak Seçimi adımı. Kütüphane kataloğundaki (öğrencinin sınıfına
 * uygun) atanmamış kaynakları ders ve yayınevine göre gruplayıp çoklu seçtirir. Katalogda hiç kaynak yoksa
 * velinin Kitaplık'tan kendi kitabını eklemesi / kitap talebi oluşturması için rehber gösterir.
 *
 * Kaydetme sorumluluğu üst bileşende: `onReady` ile verilen `save` fonksiyonu çağrılınca seçili
 * kaynaklar `PUT /api/parent/students/:id/resource-books` ile öğrenciye atanır (seçim yoksa no-op).
 */
export default function StudentResourcePicker({ studentId, onReady, hasResourceRequest = false, onResourceRequested }) {
  const [resourceBooks, setResourceBooks] = useState(null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [activeSubjectId, setActiveSubjectId] = useState(null)
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [showRequest, setShowRequest] = useState(false)

  const selectedIdsRef = useRef(selectedIds)
  selectedIdsRef.current = selectedIds
  const resourceBooksRef = useRef(resourceBooks)
  resourceBooksRef.current = resourceBooks

  useEffect(() => {
    let ignore = false
    authRequest(`/api/parent/students/${studentId}/resource-books`, { method: 'GET' })
      .then((data) => {
        if (!ignore) setResourceBooks(data.resourceBooks || [])
      })
      .catch((err) => {
        if (!ignore) setError(err.message)
      })
    return () => {
      ignore = true
    }
  }, [studentId])

  // Üst bileşene (sihirbaz) kaydetme fonksiyonunu ver.
  useEffect(() => {
    if (typeof onReady !== 'function') return
    const save = async ({ requireResource = false } = {}) => {
      if (resourceBooksRef.current === null) {
        throw new Error('Kaynaklar yüklenemedi veya henüz hazır değil. Lütfen tekrar deneyin.')
      }
      const selected = [...selectedIdsRef.current]
      const assignedIds = resourceBooksRef.current
        .filter((book) => book.assigned)
        .map((book) => book.id)
      if (requireResource && !hasResourceRequest && assignedIds.length === 0 && selected.length === 0) {
        throw new Error('Kurulumu tamamlamak için en az bir kaynak seçin. Kitabınız listede yoksa kitap ekleme talebi oluşturun.')
      }
      if (selected.length === 0) return
      await authRequest(`/api/parent/students/${studentId}/resource-books`, {
        method: 'PUT',
        body: JSON.stringify({ resourceBookIds: [...assignedIds, ...selected] }),
      })
    }
    onReady({ save })
    return () => onReady(null)
  }, [studentId, onReady, hasResourceRequest])

  const assignableBooks = useMemo(
    () => (resourceBooks || []).filter((book) => book.scope === 'catalog' && !book.assigned),
    [resourceBooks],
  )

  const filteredBooks = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('tr-TR')
    if (!normalizedQuery) return assignableBooks
    return assignableBooks.filter((book) =>
      [book.name, book.publisherName, book.subjectName]
        .filter(Boolean)
        .some((value) => value.toLocaleLowerCase('tr-TR').includes(normalizedQuery)),
    )
  }, [assignableBooks, query])

  const subjectGroups = useMemo(() => groupBySubject(filteredBooks), [filteredBooks])
  const subjectGroupIds = subjectGroups.map((group) => group.id).join(',')

  useEffect(() => {
    if (activeSubjectId && subjectGroups.some((group) => group.id === activeSubjectId)) return
    setActiveSubjectId(subjectGroups[0]?.id || null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectGroupIds])

  const activeSubject = subjectGroups.find((group) => group.id === activeSubjectId) || null

  const publisherGroups = useMemo(
    () => groupByPublisher(activeSubject?.books || []),
    [activeSubject],
  )

  const toggleResource = (bookId) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(bookId)) next.delete(bookId)
      else next.add(bookId)
      return next
    })
  }

  const requestStatus = hasResourceRequest ? (
    <p role="status" className="rounded-xl bg-panel-sage-soft p-3 text-sm text-panel-text">
      Kitap ekleme talebiniz alındı. Kurulumu tamamlayabilir, talebinizi Taleplerim menüsünden takip edebilirsiniz.
    </p>
  ) : null

  if (error) {
    return <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-sm text-panel-warm">{error}</div>
  }

  if (resourceBooks === null) {
    return <LoadingState label="Kaynaklar yükleniyor..." />
  }

  // Katalogda öğrencinin sınıfına uygun hiç kaynak yok → Kitaplık rehberi.
  if (assignableBooks.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        {requestStatus}
        <div className="rounded-xl border border-dashed border-panel-border bg-panel-blue-soft/40 px-4 py-4 text-sm leading-6 text-panel-text">
          <p className="font-semibold">{resourceBooks.some((book) => book.assigned) ? 'Çocuğunuza atanmış kaynaklar var; kurulumu tamamlayabilirsiniz.' : 'Kütüphanede bu sınıf için hazır kaynak bulunamadı.'}</p>
          <p className="mt-1 text-panel-text-muted">
            Çocuğunun kullandığı kitabı kendin ekleyebilir ya da eklenmesi için talep oluşturabilirsin.
            Kaynak eklemek için <span className="font-medium">Kitaplık’tan kaynak ekle</span> düğmesini kullanabilirsin.
            Kitabın kütüphanede yoksa kitap ekleme talebi oluşturarak kurulumu tamamlayabilirsin.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="secondary"
            size="md"
            className="gap-1.5"
            onClick={() => setShowRequest(true)}
          >
            <FilePlus2 size={16} aria-hidden="true" />
            Kitap Ekleme Talebi Oluştur
          </Button>
        </div>
        {showRequest ? (
          <BookAdditionRequestModal
            onClose={() => setShowRequest(false)}
            onSubmitted={() => { onResourceRequested?.(); setShowRequest(false) }}
            onGoToRequests={() => setShowRequest(false)}
          />
        ) : null}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
        {requestStatus}
      <Button type="button" variant="secondary" size="md" onClick={() => setShowRequest(true)}>
        <FilePlus2 size={16} aria-hidden="true" />
        Kitabım listede yok — Kitap Ekleme Talebi Oluştur
      </Button>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-panel-text-muted"
            aria-hidden="true"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Kaynak, yayınevi veya ders ara..."
            aria-label="Kaynak, yayınevi veya ders ara"
            className="w-full rounded-xl border border-panel-border bg-white py-2 pl-9 pr-3 text-sm text-panel-text focus:outline-none focus:ring-2 focus:ring-[#1c2b5e]/20"
          />
        </div>
        <span className="rounded-full bg-[#fbe9d7] px-3 py-1 text-xs font-semibold text-[#c96a1f]">
          {selectedIds.size} kaynak seçili
        </span>
      </div>

      {subjectGroups.length > 1 ? (
        <div className="flex gap-1 overflow-x-auto border-b border-panel-border">
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

      {subjectGroups.length === 0 ? (
        <p className="p-2 text-sm text-panel-text-muted">Aramayla eşleşen kaynak yok.</p>
      ) : (
        <div className="flex flex-col gap-6">
          {publisherGroups.map((publisher) => (
            <section key={publisher.id} aria-label={publisher.name} className="min-w-0">
              <div className="mb-3 flex items-center gap-2 border-b border-panel-border pb-2">
                <BookOpen size={17} className="shrink-0 text-panel-blue" aria-hidden="true" />
                <h3 className="min-w-0 break-words text-sm font-bold text-panel-text">{publisher.name}</h3>
                <span className="shrink-0 rounded-full bg-panel-surface-soft px-2 py-1 text-xs font-medium text-panel-text-muted">{publisher.books.length} kaynak</span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {publisher.books.map((book) => {
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
                        <span className="truncate text-xs text-panel-text-muted">{book.publisherName || 'Yayınevi belirtilmemiş'}</span>
                        <span className="flex flex-wrap items-center gap-1.5 pt-1">
                          <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-[#1c2b5e]">
                            {RESOURCE_BOOK_TYPE_LABELS[book.type] || book.type}
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

      {showRequest ? (
        <BookAdditionRequestModal
          onClose={() => setShowRequest(false)}
          onSubmitted={() => { onResourceRequested?.(); setShowRequest(false) }}
          onGoToRequests={() => setShowRequest(false)}
        />
      ) : null}
    </div>
  )
}
