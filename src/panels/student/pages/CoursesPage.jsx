import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, BookOpen } from 'lucide-react'
import { authRequest } from '../../../services/authClient'
import PageHeader from '../../layout/PageHeader'
import LoadingState from '../../shared/LoadingState'
import EmptyState from '../../shared/EmptyState'
import Button from '../../ui/Button'
import { ImagePreviewLightbox } from '../../shared/ResourceBookCard'

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

function ResourceCover({ book, className = 'h-20 w-16', onClick }) {
  if (book?.imageUrl) {
    const image = (
      <img loading="lazy" decoding="async"
        src={book.imageUrl}
        alt={`${book.name} görseli`}
        className={`${className} shrink-0 rounded-lg border border-[#e4e7ea] object-cover shadow-sm`}
      />
    )

    if (!onClick) return image
    return (
      <span
        role="button"
        tabIndex={0}
        onClick={(event) => {
          event.stopPropagation()
          onClick(event)
        }}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return
          event.preventDefault()
          event.stopPropagation()
          onClick(event)
        }}
        className="shrink-0 cursor-pointer rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-student-theme-primary"
        aria-label={`${book.name} görselini büyüt`}
      >
        {image}
      </span>
    )
  }

  return (
    <span className={`${className} flex shrink-0 items-center justify-center rounded-lg bg-student-theme-soft text-student-theme-text shadow-sm`}>
      <BookOpen size={22} aria-hidden="true" />
    </span>
  )
}

function SubjectShelfCard({ group, onOpen }) {
  const previewBooks = group.books.slice(0, 6)

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex min-h-[220px] flex-col justify-between rounded-2xl border border-[#e5e8e9] bg-white px-5 py-5 text-left shadow-[0_2px_10px_rgba(20,25,40,0.04)] transition-colors hover:border-student-theme-primary hover:bg-student-theme-soft/40 sm:min-h-[260px] sm:px-6 sm:py-6"
    >
      <span className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="block truncate text-lg font-bold text-panel-text sm:text-xl">{group.name}</span>
          <span className="mt-1 block text-sm font-medium text-panel-text-muted">{group.books.length} kaynak</span>
        </span>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-student-theme-soft text-student-theme-text">
          <BookOpen size={22} aria-hidden="true" />
        </span>
      </span>

      <span className="mt-5 flex flex-wrap items-end gap-3 overflow-hidden border-b-4 border-[#d9e2e3] pb-3 sm:gap-4">
        {previewBooks.map((book) => (
          <ResourceCover key={book.id} book={book} className="h-28 w-20 sm:h-32 sm:w-24" />
        ))}
      </span>
    </button>
  )
}

function ResourceCard({ book, onPreviewImage }) {
  return (
    <article className="flex min-h-[156px] gap-4 rounded-xl border border-[#e5e8e9] bg-white p-4 shadow-[0_2px_10px_rgba(20,25,40,0.04)]">
      <ResourceCover
        book={book}
        className="h-28 w-20"
        onClick={book.imageUrl ? () => onPreviewImage({ url: book.imageUrl, name: book.name }) : undefined}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div>
          <h3 className="line-clamp-2 text-base font-bold leading-snug text-panel-text">{book.name}</h3>
          <p className="mt-1 truncate text-sm text-panel-text-muted">{book.publisherName || 'Yayın evi yok'}</p>
        </div>
        <div className="mt-auto flex flex-wrap gap-2">
          <span className="rounded-full bg-student-theme-soft px-2.5 py-1 text-[11px] font-semibold text-student-theme-text">
            {RESOURCE_BOOK_TYPE_LABELS[book.type] || book.type}
          </span>
          <span className="rounded-full bg-[#f3f5f5] px-2.5 py-1 text-[11px] font-semibold text-panel-text-muted">
            {book.pageCount} sayfa
          </span>
        </div>
      </div>
    </article>
  )
}

export default function CoursesPage() {
  const [resourceBooks, setResourceBooks] = useState(null)
  const [error, setError] = useState('')
  const [selectedSubjectId, setSelectedSubjectId] = useState(null)
  const [previewImage, setPreviewImage] = useState(null)

  useEffect(() => {
    let ignore = false

    authRequest('/api/panel/resource-books', { method: 'GET' })
      .then((data) => {
        if (!ignore) setResourceBooks(data.resourceBooks)
      })
      .catch((err) => {
        if (!ignore) setError(err.message)
      })

    return () => {
      ignore = true
    }
  }, [])

  const subjectGroups = useMemo(() => groupResourceBooksBySubject(resourceBooks || []), [resourceBooks])
  const selectedGroup = subjectGroups.find((group) => group.id === selectedSubjectId) || null

  return (
    <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-5">
      <PageHeader
        title={selectedGroup ? selectedGroup.name : 'Derslerim'}
        actions={
          selectedGroup ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-10 rounded-[10px] border-[#dfe4e5] bg-white text-panel-text hover:bg-student-theme-soft"
              onClick={() => setSelectedSubjectId(null)}
            >
              <ArrowLeft size={16} className="mr-1.5 inline" aria-hidden="true" />
              Dersler
            </Button>
          ) : null
        }
      />

      {error ? (
        <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-base text-panel-warm">{error}</div>
      ) : resourceBooks === null ? (
        <LoadingState label="Dersler yükleniyor..." />
      ) : resourceBooks.length === 0 ? (
        <EmptyState icon={BookOpen} title="Henüz kaynak atanmadı" description="Ebeveyn panelinden kaynak ataması yapıldığında burada görünür." />
      ) : selectedGroup ? (
        <div className="fade-slide-in grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {selectedGroup.books.map((book) => (
            <ResourceCard key={book.id} book={book} onPreviewImage={setPreviewImage} />
          ))}
        </div>
      ) : (
        <div className="fade-slide-in grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6">
          {subjectGroups.map((group) => (
            <SubjectShelfCard key={group.id} group={group} onOpen={() => setSelectedSubjectId(group.id)} />
          ))}
        </div>
      )}

      <ImagePreviewLightbox preview={previewImage} onClose={() => setPreviewImage(null)} />
    </div>
  )
}
