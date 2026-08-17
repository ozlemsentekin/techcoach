import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, BookOpen, Plus, UserPlus } from 'lucide-react'
import { authRequest } from '../../../services/authClient'
import PageHeader from '../../layout/PageHeader'
import LoadingState from '../../shared/LoadingState'
import EmptyState from '../../shared/EmptyState'
import Button from '../../ui/Button'
import { libraryApiBase } from './libraryConstants'
import AssignLibraryResourceModal from './AssignLibraryResourceModal'
import AddLibraryResourceWizard from './AddLibraryResourceWizard'

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
  const basePath = role === 'teacher' ? '/teacher/library' : '/parent/library'
  const apiBase = libraryApiBase(role)

  const [subjects, setSubjects] = useState(null)
  const [activeSubjectId, setActiveSubjectId] = useState(null)
  const [resourceBooks, setResourceBooks] = useState(null)
  const [error, setError] = useState('')
  const [assignBook, setAssignBook] = useState(null)
  const [showAddWizard, setShowAddWizard] = useState(false)

  useEffect(() => {
    let ignore = false
    authRequest('/api/panel/subjects', { method: 'GET' })
      .then((data) => {
        if (ignore) return
        setSubjects(data.subjects)
        setActiveSubjectId((current) => current || data.subjects[0]?.id || null)
      })
      .catch((err) => {
        if (!ignore) setError(err.message)
      })
    return () => {
      ignore = true
    }
  }, [])

  const loadResourceBooks = () => {
    if (!activeSubjectId) return
    setResourceBooks(null)
    authRequest(`${apiBase}/library/resource-books?grade=${grade}&subjectId=${activeSubjectId}`, { method: 'GET' })
      .then((data) => setResourceBooks(data.resourceBooks))
      .catch((err) => setError(err.message))
  }

  useEffect(() => {
    loadResourceBooks()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSubjectId, grade])

  const activeSubject = subjects?.find((subject) => subject.id === activeSubjectId) || null

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

      {subjects === null ? (
        <LoadingState label="Dersler yükleniyor..." />
      ) : (
        <div className="flex gap-1 overflow-x-auto border-b border-panel-border">
          {subjects.map((subject) => (
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
              className="flex min-h-[128px] items-start gap-3 rounded-xl border border-panel-border bg-panel-surface p-3"
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
                  <StatusBadge status={book.status} />
                </div>
                {book.status === 'rejected' && book.rejectionReason ? (
                  <p className="text-xs text-panel-warm">Gerekçe: {book.rejectionReason}</p>
                ) : null}
                <button
                  type="button"
                  onClick={() => setAssignBook(book)}
                  className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-full bg-panel-blue-soft px-2.5 py-1 text-xs font-semibold text-panel-blue hover:opacity-90"
                >
                  <UserPlus size={12} aria-hidden="true" />
                  Ata
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {assignBook ? (
        <AssignLibraryResourceModal role={role} resourceBook={assignBook} onClose={() => setAssignBook(null)} />
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
