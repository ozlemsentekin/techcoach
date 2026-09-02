import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, BookMarked, BookOpen, FilePlus2, Plus, Settings2, Users } from 'lucide-react'
import PageHeader from '../../layout/PageHeader'
import LoadingState from '../../shared/LoadingState'
import EmptyState from '../../shared/EmptyState'
import Button from '../../ui/Button'
import { cn } from '../../ui/utils'
import { cachedGet, authRequest } from '../../../services/authClient'
import { RATE_TONES, completionRateTone, successRateTone } from '../../shared/rateTones'
import { ImagePreviewLightbox } from '../../shared/ResourceBookCard'
import { BOOKSHELF_RESOURCE_TYPE_LABELS } from '../../shared/bookshelf/bookshelfConstants'
import BookFormModal from '../../shared/bookshelf/BookFormModal'
import BookshelfDetailModal from '../../shared/bookshelf/BookshelfDetailModal'
import BookAdditionRequestModal from '../../shared/requests/BookAdditionRequestModal'

function groupBySubject(books) {
  const groups = new Map()
  books.forEach((book) => {
    const key = book.subjectId || 'no-subject'
    if (!groups.has(key)) {
      groups.set(key, { id: key, name: book.subjectName || 'Diğer Kaynaklar', books: [] })
    }
    groups.get(key).books.push(book)
  })
  return [...groups.values()].sort((a, b) =>
    a.name.localeCompare(b.name, 'tr', { sensitivity: 'base' }),
  )
}

function averageRate(books, key) {
  const values = books.map((book) => book[key]).filter((value) => value !== null && value !== undefined)
  if (!values.length) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function RateDonut({ label, value, tone, size = 26 }) {
  const hasValue = value !== null && value !== undefined
  const percentage = hasValue ? Math.round(value * 100) : 0
  const colors = RATE_TONES[tone]
  const strokeWidth = size <= 30 ? 3 : 4
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const dash = (Math.min(Math.max(percentage, 0), 100) / 100) * circumference

  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className="relative block shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-panel-border"
          />
          {hasValue ? (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={`${dash} ${circumference}`}
              className={cn('transition-all', colors.text)}
            />
          ) : null}
        </svg>
      </span>
      <span className="text-[11px] font-medium text-panel-text-muted">
        {`${label} `}
        <span className="font-bold tabular-nums text-panel-text">{hasValue ? `%${percentage}` : '—'}</span>
      </span>
    </span>
  )
}

function BookDonuts({ completionRate, successRate, size, className }) {
  return (
    <span className={cn('inline-flex flex-wrap items-center gap-x-3 gap-y-1', className)}>
      <RateDonut label="İlerleme" value={completionRate} tone={completionRateTone(completionRate)} size={size} />
      <RateDonut label="Başarı" value={successRate} tone={successRateTone(successRate)} size={size} />
    </span>
  )
}

function BookCover({ book, className = 'h-20 w-16', onClick }) {
  if (book?.imageUrl) {
    const image = (
      <img
        loading="lazy"
        decoding="async"
        src={book.imageUrl}
        alt={`${book.name} görseli`}
        className={`${className} shrink-0 rounded-lg border border-panel-border object-cover shadow-sm`}
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
        className="shrink-0 cursor-pointer rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-panel-blue"
        aria-label={`${book.name} görselini büyüt`}
      >
        {image}
      </span>
    )
  }

  return (
    <span className={`${className} flex shrink-0 items-center justify-center rounded-lg bg-panel-blue-soft text-panel-blue shadow-sm`}>
      <BookOpen size={22} aria-hidden="true" />
    </span>
  )
}

function SubjectShelfCard({ group, onOpen }) {
  const previewBooks = group.books.slice(0, 6)
  const completionRate = averageRate(group.books, 'completionRate')
  const successRate = averageRate(group.books, 'successRate')

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex min-h-[220px] flex-col justify-between rounded-2xl border border-panel-border bg-panel-surface px-5 py-5 text-left shadow-sm transition-colors hover:border-panel-blue hover:bg-panel-blue-soft/40 sm:min-h-[260px] sm:px-6 sm:py-6"
    >
      <span className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="block truncate text-lg font-bold text-panel-text sm:text-xl">{group.name}</span>
          <span className="mt-1.5 inline-flex items-center rounded-full bg-panel-blue-soft px-2.5 py-1 text-[11px] font-semibold text-panel-blue">
            {group.books.length} kaynak
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-3">
          <BookDonuts completionRate={completionRate} successRate={successRate} size={24} />
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-panel-blue-soft text-panel-blue">
            <BookOpen size={22} aria-hidden="true" />
          </span>
        </span>
      </span>

      <span className="mt-5 flex flex-wrap items-end gap-3 overflow-hidden border-b-4 border-panel-border pb-3 sm:gap-4">
        {previewBooks.map((book) => (
          <BookCover key={book.id} book={book} className="h-28 w-20 sm:h-32 sm:w-24" />
        ))}
      </span>
    </button>
  )
}

function BookCard({ book, onPreviewImage, onManage }) {
  const manageable = book.scope === 'private'

  return (
    <article className="flex min-h-[156px] gap-4 rounded-xl border border-panel-border bg-panel-surface p-4 shadow-sm">
      <BookCover
        book={book}
        className="h-28 w-20"
        onClick={book.imageUrl ? () => onPreviewImage({ url: book.imageUrl, name: book.name }) : undefined}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div>
          <h3 className="line-clamp-2 text-base font-bold leading-snug text-panel-text">{book.name}</h3>
          <p className="mt-1 truncate text-sm text-panel-text-muted">{book.publisherName || 'Yayın evi yok'}</p>
        </div>
        <div className="mt-auto flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-panel-blue-soft px-2.5 py-1 text-[11px] font-semibold text-panel-blue">
            {BOOKSHELF_RESOURCE_TYPE_LABELS[book.type] || book.type}
          </span>
          {manageable ? (
            <span className="rounded-full bg-panel-accent-soft px-2.5 py-1 text-[11px] font-semibold text-panel-accent">
              Özel kaynak
            </span>
          ) : null}
        </div>
        <BookDonuts completionRate={book.completionRate} successRate={book.successRate} className="mt-3" />
        {manageable ? (
          <button
            type="button"
            onClick={() => onManage(book)}
            className="mt-2 inline-flex w-fit items-center gap-1.5 rounded-lg border border-panel-border px-2.5 py-1 text-xs font-semibold text-panel-text-muted transition-colors hover:border-panel-blue hover:text-panel-blue"
          >
            <Settings2 size={13} aria-hidden="true" />
            İçerik ve atamaları yönet
          </button>
        ) : null}
      </div>
    </article>
  )
}

export default function ParentBookshelfPage() {
  const navigate = useNavigate()
  const [students, setStudents] = useState(null)
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [books, setBooks] = useState(null)
  const [booksStudentId, setBooksStudentId] = useState(null)
  const [error, setError] = useState('')
  const [selectedSubjectId, setSelectedSubjectId] = useState(null)
  const [previewImage, setPreviewImage] = useState(null)
  const [creating, setCreating] = useState(false)
  const [requesting, setRequesting] = useState(false)
  const [editingBook, setEditingBook] = useState(null)
  const [detailBookId, setDetailBookId] = useState(null)

  useEffect(() => {
    let ignore = false
    cachedGet('/api/parent/students')
      .then((data) => {
        if (ignore) return
        const sorted = [...(data.students || [])].sort((a, b) =>
          a.fullName.localeCompare(b.fullName, 'tr'),
        )
        setStudents(sorted)
        setSelectedStudentId((current) =>
          current && sorted.some((student) => student.id === current) ? current : sorted[0]?.id || '',
        )
      })
      .catch((err) => {
        if (!ignore) {
          setStudents([])
          setError(err.message)
        }
      })
    return () => {
      ignore = true
    }
  }, [])

  const loadBooks = (studentId = selectedStudentId, { resetSubject = false } = {}) => {
    if (!studentId) return Promise.resolve()
    return authRequest(`/api/parent/students/${studentId}/resource-books`, { method: 'GET' })
      .then((data) => {
        setBooks((data.resourceBooks || []).filter((book) => book.assigned))
        setBooksStudentId(studentId)
        if (resetSubject) setSelectedSubjectId(null)
      })
      .catch((err) => setError(err.message))
  }

  useEffect(() => {
    if (!selectedStudentId) return undefined
    let ignore = false
    authRequest(`/api/parent/students/${selectedStudentId}/resource-books`, { method: 'GET' })
      .then((data) => {
        if (ignore) return
        setBooks((data.resourceBooks || []).filter((book) => book.assigned))
        setBooksStudentId(selectedStudentId)
        setSelectedSubjectId(null)
      })
      .catch((err) => {
        if (!ignore) setError(err.message)
      })
    return () => {
      ignore = true
    }
  }, [selectedStudentId])

  const booksLoading = books === null || booksStudentId !== selectedStudentId
  const subjectGroups = useMemo(
    () => (booksLoading ? [] : groupBySubject(books || [])),
    [booksLoading, books],
  )
  const selectedGroup = subjectGroups.find((group) => group.id === selectedSubjectId) || null
  const hasMultipleStudents = (students?.length || 0) > 1
  const selectedStudent = students?.find((student) => student.id === selectedStudentId)
  const childName = selectedStudent?.fullName?.trim().split(/\s+/)[0] || 'Çocuğunuz'

  const handleCreated = (createdBook) => {
    setCreating(false)
    loadBooks()
    if (createdBook?.id) setDetailBookId(createdBook.id)
  }

  return (
    <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-5">
      <PageHeader
        title={selectedGroup ? selectedGroup.name : 'Kitaplık'}
        subtitle={
          selectedGroup
            ? null
            : `${childName} adına atanmış tüm kitaplar. Buradan yeni özel kaynak da ekleyebilirsiniz.`
        }
        actions={
          selectedGroup ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="gap-1.5"
              onClick={() => setSelectedSubjectId(null)}
            >
              <ArrowLeft size={16} aria-hidden="true" />
              Dersler
            </Button>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="md"
                variant="secondary"
                className="gap-1.5"
                onClick={() => setRequesting(true)}
              >
                <FilePlus2 size={16} aria-hidden="true" />
                Kitap Ekleme Talebi Oluştur
              </Button>
              <Button type="button" size="md" className="gap-1.5" onClick={() => setCreating(true)}>
                <Plus size={16} aria-hidden="true" />
                Yeni Kitap Ekle
              </Button>
            </div>
          )
        }
      />

      {hasMultipleStudents && !selectedGroup ? (
        <label className="inline-flex w-fit items-center gap-2 rounded-full border border-panel-border bg-panel-surface-soft px-3 py-1 text-sm font-semibold text-panel-text">
          <Users size={15} aria-hidden="true" />
          <select
            value={selectedStudentId}
            onChange={(event) => setSelectedStudentId(event.target.value)}
            aria-label="Çocuk seç"
            className="bg-transparent text-sm font-semibold text-panel-text focus:outline-none"
          >
            {students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.fullName}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {error ? (
        <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-base text-panel-warm">{error}</div>
      ) : students === null || booksLoading ? (
        <LoadingState label="Kitaplık yükleniyor..." />
      ) : books.length === 0 ? (
        <EmptyState
          icon={BookMarked}
          title="Henüz kitap atanmadı"
          description={`${childName} için kaynak atandığında burada listelenir. "Yeni Kitap Ekle" ile kendi özel kaynağınızı da ekleyebilirsiniz.`}
        />
      ) : selectedGroup ? (
        <div className="fade-slide-in grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {selectedGroup.books.map((book) => (
            <BookCard
              key={book.id}
              book={book}
              onPreviewImage={setPreviewImage}
              onManage={(target) => setDetailBookId(target.id)}
            />
          ))}
        </div>
      ) : (
        <div className="fade-slide-in grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6">
          {subjectGroups.map((group) => (
            <SubjectShelfCard key={group.id} group={group} onOpen={() => setSelectedSubjectId(group.id)} />
          ))}
        </div>
      )}

      {creating ? (
        <BookFormModal onSaved={handleCreated} onClose={() => setCreating(false)} />
      ) : null}

      {requesting ? (
        <BookAdditionRequestModal
          onClose={() => setRequesting(false)}
          onGoToRequests={() => {
            setRequesting(false)
            navigate('/parent/requests')
          }}
        />
      ) : null}

      {editingBook ? (
        <BookFormModal
          book={editingBook}
          onSaved={() => {
            setEditingBook(null)
            loadBooks()
          }}
          onClose={() => setEditingBook(null)}
        />
      ) : null}

      {detailBookId ? (
        <BookshelfDetailModal
          resourceBookId={detailBookId}
          showAssignees
          onChanged={loadBooks}
          onEdit={(book) => {
            setDetailBookId(null)
            setEditingBook(book)
          }}
          onClose={() => setDetailBookId(null)}
        />
      ) : null}

      <ImagePreviewLightbox preview={previewImage} onClose={() => setPreviewImage(null)} />
    </div>
  )
}
