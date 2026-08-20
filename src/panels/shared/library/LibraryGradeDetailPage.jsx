import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, BookOpen, Plus, Trash2, UserPlus } from 'lucide-react'
import { authRequest } from '../../../services/authClient'
import { useAuth } from '../../../context/useAuth'
import PageHeader from '../../layout/PageHeader'
import LoadingState from '../../shared/LoadingState'
import EmptyState from '../../shared/EmptyState'
import Button from '../../ui/Button'
import ConfirmationDialog from '../../shared/ConfirmationDialog'
import { libraryApiBase } from './libraryConstants'
import AssignLibraryResourceModal from './AssignLibraryResourceModal'
import AddLibraryResourceWizard from './AddLibraryResourceWizard'
import LibraryResourceDetailModal from './LibraryResourceDetailModal'
import ResourceSourceBadge from './ResourceSourceBadge'
import { RESOURCE_SOURCE_LABELS } from './libraryConstants'

const RESOURCE_BOOK_TYPE_LABELS = {
  konu_anlatimi: 'Konu Anlatımı',
  soru_bankasi: 'Soru Bankası',
  okuma_kitabi: 'Okuma Kitabı',
  etkinlik: 'Etkinlik & Soru Bankası',
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

function StatusBadge({ status }) {
  if (status === 'pending') {
    return (
      <span className="inline-flex w-fit items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
        Onay Bekliyor
      </span>
    )
  }
  if (status === 'rejected') {
    return (
      <span className="inline-flex w-fit items-center rounded-full bg-panel-accent-soft px-2 py-0.5 text-[11px] font-semibold text-panel-warm">
        Reddedildi
      </span>
    )
  }
  return null
}

export default function LibraryGradeDetailPage({ role }) {
  const { grade } = useParams()
  const navigate = useNavigate()
  const { authUser } = useAuth()
  const basePath = role === 'teacher' ? '/teacher/library' : '/parent/library'
  const apiBase = libraryApiBase(role)

  const [subjects, setSubjects] = useState(null)
  const [activeSubjectId, setActiveSubjectId] = useState(null)
  const [activeSource, setActiveSource] = useState(null)
  const [resourceBooks, setResourceBooks] = useState(null)
  const [error, setError] = useState('')
  const [assignBook, setAssignBook] = useState(null)
  const [viewBookId, setViewBookId] = useState(null)
  const [showAddWizard, setShowAddWizard] = useState(false)
  const [deletingBook, setDeletingBook] = useState(null)
  const [deletingError, setDeletingError] = useState('')
  const [deletingLoading, setDeletingLoading] = useState(false)

  useEffect(() => {
    let ignore = false
    authRequest('/api/panel/subjects', { method: 'GET' })
      .then((data) => {
        if (ignore) return
        setSubjects(data.subjects)
      })
      .catch((err) => {
        if (!ignore) setError(err.message)
      })
    return () => {
      ignore = true
    }
  }, [])

  // Öğretmenler kütüphanede sadece kendi branşlarının sekmelerini görür; branşı henüz
  // atanmamış (eski) öğretmen hesaplarında geriye dönük uyumluluk için tüm dersler gösterilir.
  const teacherSubjectIds = authUser?.teacherSubjectIds
  const visibleSubjects = useMemo(() => {
    if (!subjects) return null
    if (role !== 'teacher' || !teacherSubjectIds?.length) return subjects
    const normalizedIds = teacherSubjectIds.map((id) => id.toLowerCase())
    return subjects.filter((subject) => normalizedIds.includes(subject.id.toLowerCase()))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjects, role, teacherSubjectIds?.length])

  useEffect(() => {
    if (!visibleSubjects) return
    setActiveSubjectId((current) => current || visibleSubjects[0]?.id || null)
  }, [visibleSubjects])

  const loadResourceBooks = () => {
    if (!activeSubjectId) return
    setResourceBooks(null)
    const sourceParam = activeSource ? `&source=${activeSource}` : ''
    authRequest(`${apiBase}/library/resource-books?grade=${grade}&subjectId=${activeSubjectId}${sourceParam}`, {
      method: 'GET',
    })
      .then((data) => setResourceBooks(data.resourceBooks))
      .catch((err) => setError(err.message))
  }

  useEffect(() => {
    loadResourceBooks()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSubjectId, activeSource, grade])

  const activeSubject = visibleSubjects?.find((subject) => subject.id === activeSubjectId) || null

  const handleDeleteBook = async () => {
    if (!deletingBook) return
    setDeletingLoading(true)
    setDeletingError('')
    try {
      await authRequest(`${apiBase}/library/resource-books/${deletingBook.id}`, { method: 'DELETE' })
      setDeletingBook(null)
      loadResourceBooks()
    } catch (err) {
      setDeletingError(err.message)
    } finally {
      setDeletingLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <button
        type="button"
        onClick={() => navigate(basePath)}
        className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-panel-text-muted hover:text-panel-text"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        Sınıflar
      </button>

      <PageHeader
        title={`${grade}. Sınıf Kütüphanesi`}
        subtitle="Bir ders seçip mevcut kaynaklara göz atın veya yeni kaynak ekleyin."
        actions={
          <Button type="button" onClick={() => setShowAddWizard(true)} disabled={!activeSubjectId}>
            <Plus size={16} aria-hidden="true" />
            Kaynak Ekle
          </Button>
        }
      />

      {error ? <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-base text-panel-warm">{error}</div> : null}

      {visibleSubjects === null ? (
        <LoadingState label="Dersler yükleniyor..." />
      ) : (
        <div className="flex gap-1 overflow-x-auto border-b border-panel-border">
          {visibleSubjects.map((subject) => (
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
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {[{ value: null, label: 'Tümü' }, ...Object.entries(RESOURCE_SOURCE_LABELS).map(([value, label]) => ({ value, label }))].map(
          (option) => (
            <button
              key={option.label}
              type="button"
              onClick={() => setActiveSource(option.value)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                activeSource === option.value
                  ? 'border-panel-blue bg-panel-blue-soft text-panel-blue'
                  : 'border-panel-border text-panel-text-muted hover:border-panel-blue'
              }`}
            >
              {option.label}
            </button>
          ),
        )}
      </div>

      {resourceBooks === null ? (
        <LoadingState label="Kaynaklar yükleniyor..." />
      ) : resourceBooks.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="Bu derste henüz kaynak yok"
          description="Bu sınıf ve derse ait bir kaynak bulunmuyor. İsterseniz ilk kaynağı siz ekleyebilirsiniz."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {resourceBooks.map((book) => (
            <div
              key={book.id}
              role="button"
              tabIndex={0}
              onClick={() => setViewBookId(book.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  setViewBookId(book.id)
                }
              }}
              className="flex min-h-[128px] cursor-pointer items-start gap-3 rounded-xl border border-panel-border bg-panel-surface p-3 transition-colors hover:border-panel-blue"
            >
              <ResourceAvatar book={book} />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <p className="line-clamp-2 text-sm font-bold leading-snug text-panel-text">{book.name}</p>
                <p className="truncate text-xs text-panel-text-muted">{book.publisherName || 'Yayın evi yok'}</p>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full bg-panel-surface-soft px-2 py-0.5 text-[11px] font-medium text-panel-text">
                    {RESOURCE_BOOK_TYPE_LABELS[book.type] || book.type}
                  </span>
                  <span className="rounded-full bg-panel-surface-soft px-2 py-0.5 text-[11px] font-medium text-panel-text-muted">
                    {book.pageCount} sayfa
                  </span>
                  <ResourceSourceBadge source={book.resourceSource} />
                  <StatusBadge status={book.status} />
                </div>
                {book.status === 'rejected' && book.rejectionReason ? (
                  <p className="text-xs text-panel-warm">Gerekçe: {book.rejectionReason}</p>
                ) : null}
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      setAssignBook(book)
                    }}
                    className="inline-flex w-fit items-center gap-1.5 rounded-full bg-panel-blue-soft px-2.5 py-1 text-xs font-semibold text-panel-blue hover:opacity-90"
                  >
                    <UserPlus size={12} aria-hidden="true" />
                    Ata
                  </button>
                  {book.canDelete ? (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        setDeletingError('')
                        setDeletingBook(book)
                      }}
                      className="inline-flex w-fit items-center gap-1.5 rounded-full bg-panel-accent-soft px-2.5 py-1 text-xs font-semibold text-panel-warm hover:opacity-90"
                    >
                      <Trash2 size={12} aria-hidden="true" />
                      Sil
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {assignBook ? (
        <AssignLibraryResourceModal role={role} resourceBook={assignBook} onClose={() => setAssignBook(null)} />
      ) : null}

      {viewBookId ? (
        <LibraryResourceDetailModal
          role={role}
          resourceBookId={viewBookId}
          onClose={() => setViewBookId(null)}
          onAssign={(book) => {
            setViewBookId(null)
            setAssignBook(book)
          }}
          onDeleted={() => {
            setViewBookId(null)
            loadResourceBooks()
          }}
        />
      ) : null}

      {deletingBook ? (
        <ConfirmationDialog
          title="Kaynağı Sil"
          description={
            deletingError ||
            `"${deletingBook.name}" kaynağını kütüphaneden silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`
          }
          confirmLabel={deletingLoading ? 'Siliniyor...' : 'Sil'}
          cancelLabel="Vazgeç"
          onConfirm={handleDeleteBook}
          onCancel={() => {
            setDeletingBook(null)
            setDeletingError('')
          }}
        />
      ) : null}

      {showAddWizard && activeSubjectId ? (
        <AddLibraryResourceWizard
          role={role}
          grade={grade}
          subjectId={activeSubjectId}
          subjectName={activeSubject?.name}
          onClose={() => setShowAddWizard(false)}
          onSubmitted={() => {
            setShowAddWizard(false)
            loadResourceBooks()
          }}
        />
      ) : null}
    </div>
  )
}
