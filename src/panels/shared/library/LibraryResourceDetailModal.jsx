import { useEffect, useState } from 'react'
import { BookOpen, Pencil, Trash2, UserPlus, X } from 'lucide-react'
import { authRequest } from '../../../services/authClient'
import LoadingState from '../../shared/LoadingState'
import Badge from '../../ui/Badge'
import Button from '../../ui/Button'
import ConfirmationDialog from '../../shared/ConfirmationDialog'
import { libraryApiBase } from './libraryConstants'
import AddLibraryResourceContentModal from './AddLibraryResourceContentModal'

const RESOURCE_BOOK_TYPE_LABELS = {
  konu_anlatimi: 'Konu Anlatımı',
  soru_bankasi: 'Soru Bankası',
  okuma_kitabi: 'Okuma Kitabı',
  etkinlik: 'Etkinlik & Soru Bankası',
}

export default function LibraryResourceDetailModal({ role, resourceBookId, onClose, onAssign, onDeleted }) {
  const apiBase = libraryApiBase(role)

  const [detail, setDetail] = useState(null)
  const [error, setError] = useState('')
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [showContentModal, setShowContentModal] = useState(false)

  useEffect(() => {
    let ignore = false
    authRequest(`${apiBase}/library/resource-books/${resourceBookId}`, { method: 'GET' })
      .then((data) => {
        if (!ignore) setDetail(data)
      })
      .catch((err) => {
        if (!ignore) setError(err.message)
      })
    return () => {
      ignore = true
    }
  }, [apiBase, resourceBookId])

  const book = detail?.resourceBook
  const topics = detail?.topics || []

  const handleDelete = async () => {
    setDeleteLoading(true)
    setDeleteError('')
    try {
      await authRequest(`${apiBase}/library/resource-books/${resourceBookId}`, { method: 'DELETE' })
      setConfirmingDelete(false)
      onDeleted?.()
    } catch (err) {
      setDeleteError(err.message)
    } finally {
      setDeleteLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-stretch justify-center bg-black/30 p-0 sm:items-center sm:p-4">
      <div className="flex h-full w-full max-w-3xl flex-col overflow-hidden border border-panel-border bg-panel-surface p-4 shadow-panel-1 sm:h-[85vh] sm:max-h-[95vh] sm:rounded-2xl sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {book?.imageUrl ? (
              <img
                src={book.imageUrl}
                alt={`${book.name} görseli`}
                className="h-14 w-14 shrink-0 rounded-xl border border-panel-border object-cover"
              />
            ) : (
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#fbe9d7] text-[#c96a1f]">
                <BookOpen size={22} aria-hidden="true" />
              </span>
            )}
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold text-panel-text">{book?.name || 'Kaynak'}</h2>
              {book ? (
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {book.publisherName ? <Badge tone="lilac">{book.publisherName}</Badge> : null}
                  <Badge tone="slate">{RESOURCE_BOOK_TYPE_LABELS[book.type] || book.type}</Badge>
                  <Badge tone="slate">{book.pageCount} sayfa</Badge>
                </div>
              ) : null}
            </div>
          </div>
          <button type="button" aria-label="Kapat" onClick={onClose} className="shrink-0">
            <X size={20} />
          </button>
        </div>

        {error ? (
          <div className="mb-3 rounded-xl bg-panel-accent-soft px-3 py-2 text-sm text-panel-warm">{error}</div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto">
          {!detail && !error ? (
            <LoadingState label="Kaynak yükleniyor..." />
          ) : topics.length === 0 ? (
            <div className="flex flex-col items-start gap-2 p-2">
              <p className="text-sm text-panel-text-muted">Bu kaynağa ait içerik girilmemiş.</p>
              <Button type="button" size="sm" variant="secondary" onClick={() => setShowContentModal(true)} className="gap-1.5">
                <Pencil size={14} aria-hidden="true" />
                Kaynak Düzenle
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {topics.map((topic) => (
                <div key={topic.id} className="rounded-xl border border-panel-border p-3">
                  <p className="mb-2 text-sm font-semibold text-panel-text">{topic.name}</p>
                  <div className="flex flex-col gap-1">
                    {topic.tests.map((test) => (
                      <div
                        key={test.id}
                        className="flex flex-wrap items-center gap-2 rounded-lg bg-panel-surface-soft px-2.5 py-1.5 text-xs text-panel-text-muted"
                      >
                        {test.topicName ? (
                          <Badge tone="slate" className="shrink-0">
                            {test.topicName}
                          </Badge>
                        ) : null}
                        <span className="min-w-0 truncate text-panel-text">{test.name}</span>
                        <span className="ml-auto shrink-0 whitespace-nowrap">
                          s.{test.pageStart}-{test.pageEnd} · {test.questionCount} soru
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {book ? (
          <div className="mt-4 flex flex-col items-stretch gap-2 border-t border-panel-border pt-4 sm:flex-row sm:items-center sm:justify-end">
            {book.canDelete ? (
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => {
                  setDeleteError('')
                  setConfirmingDelete(true)
                }}
                className="gap-1.5"
              >
                <Trash2 size={15} aria-hidden="true" />
                Sil
              </Button>
            ) : null}
            {onAssign ? (
              <Button type="button" size="md" onClick={() => onAssign(book)} className="gap-1.5">
                <UserPlus size={15} aria-hidden="true" />
                Ata
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      {confirmingDelete ? (
        <ConfirmationDialog
          title="Kaynağı Sil"
          description={
            deleteError || `"${book?.name}" kaynağını kütüphaneden silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`
          }
          confirmLabel={deleteLoading ? 'Siliniyor...' : 'Sil'}
          cancelLabel="Vazgeç"
          onConfirm={handleDelete}
          onCancel={() => {
            setConfirmingDelete(false)
            setDeleteError('')
          }}
        />
      ) : null}

      {showContentModal && book ? (
        <AddLibraryResourceContentModal
          role={role}
          resourceBook={book}
          onClose={() => setShowContentModal(false)}
          onSubmitted={(updatedDetail) => {
            setDetail(updatedDetail)
            setShowContentModal(false)
          }}
        />
      ) : null}
    </div>
  )
}
