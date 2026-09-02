import { useEffect, useState } from 'react'
import { ArrowLeft, Plus, Trash2, X } from 'lucide-react'
import Badge from '../../ui/Badge'
import Button from '../../ui/Button'
import LoadingState from '../../shared/LoadingState'
import ConfirmationDialog from '../../shared/ConfirmationDialog'
import { ImagePreviewLightbox, ResourceBookAvatar, ResourceBookRates } from '../../shared/ResourceBookCard'
import { authRequest } from '../../../services/authClient'
import StudentResourceAssignModal from './StudentResourceAssignModal'
import ResourceSolveList from '../../shared/bookshelf/ResourceSolveList'

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

export default function StudentResourceLibraryModal({ student, onClose }) {
  const [resourceBooks, setResourceBooks] = useState(null)
  const [error, setError] = useState('')
  const [activeSubjectId, setActiveSubjectId] = useState(null)
  const [selectedBook, setSelectedBook] = useState(null)
  const [removingBook, setRemovingBook] = useState(null)
  const [removeError, setRemoveError] = useState('')
  const [removing, setRemoving] = useState(false)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [previewImage, setPreviewImage] = useState(null)

  useEffect(() => {
    let ignore = false

    authRequest(`/api/parent/students/${student.id}/resource-books`)
      .then((data) => {
        if (!ignore) setResourceBooks(data.resourceBooks.filter((book) => book.assigned))
      })
      .catch((err) => {
        if (!ignore) setError(err.message)
      })

    return () => {
      ignore = true
    }
  }, [student.id])

  const subjectGroups = resourceBooks ? groupResourceBooksBySubject(resourceBooks) : []

  useEffect(() => {
    if (activeSubjectId || subjectGroups.length === 0) return
    setActiveSubjectId(subjectGroups[0].id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectGroups.length])

  const activeSubject = subjectGroups.find((group) => group.id === activeSubjectId) || null

  const title = selectedBook ? selectedBook.name : 'Kaynaklar'

  const handleRemoveBook = async () => {
    if (!removingBook) return
    setRemoving(true)
    setRemoveError('')
    try {
      const remainingIds = resourceBooks.filter((book) => book.id !== removingBook.id).map((book) => book.id)
      await authRequest(`/api/parent/students/${student.id}/resource-books`, {
        method: 'PUT',
        body: JSON.stringify({ resourceBookIds: remainingIds }),
      })
      setResourceBooks((current) => current.filter((book) => book.id !== removingBook.id))
      setActiveSubjectId((current) => {
        const stillHasBooks = resourceBooks.some(
          (book) => book.id !== removingBook.id && (book.subjectId || 'no-subject') === current,
        )
        if (stillHasBooks) return current
        const nextGroup = subjectGroups.find((group) => group.id !== current)
        return nextGroup ? nextGroup.id : current
      })
      setRemovingBook(null)
    } catch (err) {
      setRemoveError(err.message)
    } finally {
      setRemoving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center overflow-hidden bg-black/30 p-0 sm:items-center sm:p-4">
      <div className="flex h-full w-full max-w-4xl min-w-0 flex-col overflow-hidden border border-panel-border bg-panel-surface p-4 shadow-panel-1 sm:h-[88vh] sm:max-h-[92vh] sm:rounded-2xl sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            {selectedBook ? (
              <button
                type="button"
                onClick={() => setSelectedBook(null)}
                aria-label="Kaynak listesine dön"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-panel-text-muted hover:bg-panel-surface-soft"
              >
                <ArrowLeft size={18} aria-hidden="true" />
              </button>
            ) : null}
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold text-panel-text">{title}</h2>
              {selectedBook ? (
                selectedBook.publisherName ? (
                  <p className="text-xs text-panel-text-muted">{selectedBook.publisherName}</p>
                ) : null
              ) : (
                <p className="text-xs text-panel-text-muted">{student.fullName}</p>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {!selectedBook ? (
              <Button type="button" size="sm" onClick={() => setShowAssignModal(true)} className="gap-1.5">
                <Plus size={15} aria-hidden="true" />
                Kaynak Ata
              </Button>
            ) : null}
            <button type="button" aria-label="Kapat" onClick={onClose} className="shrink-0">
              <X size={20} />
            </button>
          </div>
        </div>

        {!selectedBook && subjectGroups.length > 1 ? (
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

        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
          {selectedBook ? (
            <ResourceSolveList key={selectedBook.id} studentId={student.id} book={selectedBook} />
          ) : error ? (
            <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-sm text-panel-warm">{error}</div>
          ) : resourceBooks === null ? (
            <LoadingState label="Kaynaklar yükleniyor..." />
          ) : resourceBooks.length === 0 ? (
            <p className="p-2 text-sm text-panel-text-muted">Bu öğrenci için atanmış kaynak yok.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(activeSubject?.books || []).map((book) => (
                <div
                  key={book.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedBook(book)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      setSelectedBook(book)
                    }
                  }}
                  className="group relative grid cursor-pointer grid-cols-[3.5rem_minmax(0,1fr)] items-start gap-3 rounded-xl border border-panel-border bg-white p-3 pr-10 text-left shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-panel-blue hover:shadow-md sm:grid-cols-[4rem_minmax(0,1fr)]"
                >
                  <button
                    type="button"
                    aria-label={`${book.name} kaynağını kaldır`}
                    onClick={(event) => {
                      event.stopPropagation()
                      setRemoveError('')
                      setRemovingBook(book)
                    }}
                    className="absolute right-2 top-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-panel-text-muted hover:bg-panel-accent-soft hover:text-panel-warm"
                  >
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                  <ResourceBookAvatar
                    book={book}
                    size="row"
                    onClick={book.imageUrl ? () => setPreviewImage({ url: book.imageUrl, name: book.name }) : undefined}
                  />
                  <div className="min-w-0 flex-1">
                    {book.publisherName ? (
                      <Badge tone="lilac" className="mb-1 max-w-full overflow-hidden text-ellipsis whitespace-nowrap">
                        {book.publisherName}
                      </Badge>
                    ) : null}
                    <p className="line-clamp-2 text-sm font-semibold leading-snug text-panel-text group-hover:text-panel-blue">
                      {book.name}
                    </p>
                    <ResourceBookRates
                      completionRate={book.completionRate}
                      successRate={book.successRate}
                      className="grid-cols-2"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {removingBook ? (
        <ConfirmationDialog
          title="Kaynağı kaldır"
          description={
            removeError ||
            `"${removingBook.name}" adlı kaynağı ${student.fullName} için kaldırmak istediğinize emin misiniz?`
          }
          confirmLabel={removing ? 'Kaldırılıyor...' : 'Kaldır'}
          cancelLabel="Vazgeç"
          onCancel={() => {
            if (removing) return
            setRemovingBook(null)
            setRemoveError('')
          }}
          onConfirm={handleRemoveBook}
        />
      ) : null}

      {showAssignModal ? (
        <StudentResourceAssignModal
          student={student}
          onSaved={(_studentId, _resourceCount, updatedResourceBooks) => {
            setResourceBooks(updatedResourceBooks.filter((book) => book.assigned))
            setShowAssignModal(false)
          }}
          onClose={() => setShowAssignModal(false)}
        />
      ) : null}

      <ImagePreviewLightbox preview={previewImage} onClose={() => setPreviewImage(null)} />
    </div>
  )
}
