import { useEffect, useMemo, useState } from 'react'
import { Archive, BookMarked, Plus, Search, Users } from 'lucide-react'
import PageHeader from '../../layout/PageHeader'
import LoadingState from '../LoadingState'
import EmptyState from '../EmptyState'
import Button from '../../ui/Button'
import Badge from '../../ui/Badge'
import { ResourceBookAvatar } from '../ResourceBookCard'
import { useAuth } from '../../../context/useAuth'
import { getBookshelfBooks } from '../../../services/bookshelfService'
import { BOOKSHELF_RESOURCE_TYPE_LABELS } from './bookshelfConstants'
import BookFormModal from './BookFormModal'
import BookshelfDetailModal from './BookshelfDetailModal'

function groupBySubject(books) {
  const groups = new Map()
  books.forEach((book) => {
    const key = book.subjectId || 'no-subject'
    if (!groups.has(key)) {
      groups.set(key, { id: key, name: book.subjectName || 'Diğer', books: [] })
    }
    groups.get(key).books.push(book)
  })
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, 'tr', { sensitivity: 'base' }))
}

function BookCard({ book, showAssignees, showCreator, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group grid grid-cols-[3.5rem_minmax(0,1fr)] items-start gap-3 rounded-xl border border-panel-border bg-white p-3 text-left shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-panel-blue hover:shadow-md"
    >
      <ResourceBookAvatar book={book} size="row" />
      <div className="min-w-0">
        {book.publisherName ? (
          <Badge tone="lilac" className="mb-1 max-w-full overflow-hidden text-ellipsis whitespace-nowrap">
            {book.publisherName}
          </Badge>
        ) : null}
        <p className="line-clamp-2 text-sm font-semibold leading-snug text-panel-text group-hover:text-panel-blue">
          {book.name}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-panel-text-muted">
          <span>{BOOKSHELF_RESOURCE_TYPE_LABELS[book.type] || book.type}</span>
          {book.grade ? <span>· {book.grade}. sınıf</span> : null}
          {showAssignees && book.assignedCount ? (
            <span className="inline-flex items-center gap-1">
              · <Users size={11} aria-hidden="true" /> {book.assignedCount}
            </span>
          ) : null}
          {showCreator && book.createdByName ? <span>· ekleyen: {book.createdByName}</span> : null}
        </div>
      </div>
    </button>
  )
}

export default function BookshelfPage({ students = [], showAssignees = true }) {
  const { authUser } = useAuth()
  // Admin, yönettiği öğrenci olmadığından yeni kaynak ekleyemez / atayamaz; Kitaplık ekranı
  // onun için tüm özel kaynakları görüp gerektiğinde silebildiği bir denetim görünümüdür.
  const adminView = Boolean(authUser?.isAdmin) && students.length === 0

  const [books, setBooks] = useState(null)
  const [error, setError] = useState('')
  const [activeSubjectId, setActiveSubjectId] = useState(null)
  const [showArchive, setShowArchive] = useState(false)
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const [editingBook, setEditingBook] = useState(null)
  const [detailBookId, setDetailBookId] = useState(null)

  const load = () => {
    getBookshelfBooks()
      .then((data) => setBooks(data))
      .catch((err) => setError(err.message))
  }

  useEffect(() => {
    load()
  }, [])

  const filteredBooks = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr-TR')
    if (!q) return books || []
    return (books || []).filter((book) =>
      [book.name, book.publisherName, book.subjectName, book.createdByName]
        .filter(Boolean)
        .some((value) => value.toLocaleLowerCase('tr-TR').includes(q)),
    )
  }, [books, query])

  const activeBooks = useMemo(() => filteredBooks.filter((book) => !book.archived), [filteredBooks])
  const archivedBooks = useMemo(() => filteredBooks.filter((book) => book.archived), [filteredBooks])
  const subjectGroups = useMemo(() => groupBySubject(activeBooks), [activeBooks])

  const effectiveSubjectId =
    activeSubjectId && subjectGroups.some((group) => group.id === activeSubjectId)
      ? activeSubjectId
      : subjectGroups[0]?.id || null
  const activeGroup = subjectGroups.find((group) => group.id === effectiveSubjectId) || null

  const handleCreated = (createdBook) => {
    setCreating(false)
    load()
    if (createdBook?.id) setDetailBookId(createdBook.id)
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Kitaplık"
        subtitle={
          adminView
            ? 'Veli, öğretmen ve öğrencilerin eklediği tüm özel kaynaklar (denetim).'
            : 'Yalnızca sizin ve çocuğunuzun/öğrencinizin gördüğü özel kaynaklar.'
        }
        actions={
          adminView ? null : (
            <Button type="button" size="md" className="gap-1.5" onClick={() => setCreating(true)}>
              <Plus size={16} aria-hidden="true" />
              Yeni Kitap Ekle
            </Button>
          )
        }
      />

      {books && (books.length > 0 || query) ? (
        <div className="relative max-w-sm">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-panel-text-muted"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={adminView ? 'Kaynak, yayın evi, ekleyen ara...' : 'Kaynak ara...'}
            className="w-full rounded-xl border border-panel-border bg-white py-2 pl-9 pr-3 text-sm text-panel-text outline-none focus:border-panel-blue focus:ring-2 focus:ring-panel-blue/10"
          />
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-base text-panel-warm">{error}</div>
      ) : books === null ? (
        <LoadingState label="Kitaplık yükleniyor..." />
      ) : books.length === 0 ? (
        <EmptyState
          icon={BookMarked}
          title={adminView ? 'Henüz özel kaynak yok' : 'Kitaplığınız boş'}
          description={
            adminView
              ? 'Veli, öğretmen veya öğrenciler kaynak ekledikçe burada listelenir.'
              : '"Yeni Kitap Ekle" ile ilk özel kaynağınızı ekleyin.'
          }
        />
      ) : filteredBooks.length === 0 ? (
        <EmptyState icon={Search} title="Sonuç yok" description="Aramanızla eşleşen kaynak bulunamadı." />
      ) : (
        <>
          {subjectGroups.length > 0 ? (
            <>
              <div className="flex gap-1 overflow-x-auto border-b border-panel-border">
                {subjectGroups.map((group) => (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => setActiveSubjectId(group.id)}
                    className={`shrink-0 whitespace-nowrap border-b-2 px-3 pb-2.5 text-sm font-semibold transition-colors ${
                      effectiveSubjectId === group.id
                        ? 'border-panel-blue text-panel-blue'
                        : 'border-transparent text-panel-text-muted hover:text-panel-text'
                    }`}
                  >
                    {group.name}
                    <span className="ml-1.5 text-xs font-medium text-panel-text-muted">({group.books.length})</span>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {(activeGroup?.books || []).map((book) => (
                  <BookCard
                    key={book.id}
                    book={book}
                    showAssignees={showAssignees}
                    showCreator={adminView}
                    onClick={() => setDetailBookId(book.id)}
                  />
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-panel-text-muted">
              Güncel sınıfa ait kaynak yok. Arşivdeki kaynaklara aşağıdan bakabilirsiniz.
            </p>
          )}

          {archivedBooks.length > 0 ? (
            <div className="rounded-xl border border-panel-border">
              <button
                type="button"
                onClick={() => setShowArchive((value) => !value)}
                className="flex w-full items-center gap-2 px-4 py-3 text-sm font-semibold text-panel-text"
              >
                <Archive size={15} className="text-panel-text-muted" aria-hidden="true" />
                Arşiv ({archivedBooks.length})
                <span className="ml-auto text-xs font-medium text-panel-text-muted">
                  {showArchive ? 'gizle' : 'göster'}
                </span>
              </button>
              {showArchive ? (
                <div className="grid grid-cols-1 gap-3 border-t border-panel-border p-3 sm:grid-cols-2">
                  {archivedBooks.map((book) => (
                    <BookCard
                      key={book.id}
                      book={book}
                      showAssignees={showAssignees}
                      showCreator={adminView}
                      onClick={() => setDetailBookId(book.id)}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </>
      )}

      {creating ? (
        <BookFormModal
          students={students}
          onSaved={handleCreated}
          onClose={() => setCreating(false)}
        />
      ) : null}

      {editingBook ? (
        <BookFormModal
          book={editingBook}
          onSaved={() => {
            setEditingBook(null)
            load()
          }}
          onClose={() => setEditingBook(null)}
        />
      ) : null}

      {detailBookId ? (
        <BookshelfDetailModal
          resourceBookId={detailBookId}
          students={students}
          showAssignees={showAssignees}
          onChanged={load}
          onEdit={(book) => {
            setDetailBookId(null)
            setEditingBook(book)
          }}
          onClose={() => setDetailBookId(null)}
        />
      ) : null}
    </div>
  )
}
