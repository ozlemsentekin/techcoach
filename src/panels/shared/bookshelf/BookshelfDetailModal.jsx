import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, KeyRound, Pencil, Plus, Trash2, X } from 'lucide-react'
import Button from '../../ui/Button'
import LoadingState from '../LoadingState'
import ConfirmationDialog from '../ConfirmationDialog'
import { ResourceBookAvatar, ImagePreviewLightbox } from '../ResourceBookCard'
import { TopicModal, TestModal, AnswerKeyFlow } from '../library/resourceBookModals'
import {
  deleteBookshelfBook,
  getBookshelfBook,
  getBookshelfStudents,
  setBookshelfBookStudents,
} from '../../../services/bookshelfService'
import { authRequest } from '../../../services/authClient'
import { BOOKSHELF_RESOURCE_TYPE_LABELS } from './bookshelfConstants'
import StudentPicker from './StudentPicker'

function ContentTab({ book, topics, tests, canEdit, onChanged }) {
  const [expandedTopicId, setExpandedTopicId] = useState(null)
  const [topicModalOpen, setTopicModalOpen] = useState(false)
  const [editingTopic, setEditingTopic] = useState(null)
  const [testModalTopic, setTestModalTopic] = useState(null)
  const [editingTest, setEditingTest] = useState(null)
  const [answerKeyTest, setAnswerKeyTest] = useState(null)
  const [deletingTest, setDeletingTest] = useState(null)
  const [deleteError, setDeleteError] = useState('')
  const [deleting, setDeleting] = useState(false)

  const testsByTopic = useMemo(() => {
    const map = new Map()
    tests.forEach((test) => {
      const list = map.get(test.topicId) || []
      list.push(test)
      map.set(test.topicId, list)
    })
    return map
  }, [tests])

  const showAnswerKey = book.type === 'soru_bankasi' || book.type === 'etkinlik'

  const handleDeleteTest = async () => {
    if (!deletingTest) return
    setDeleting(true)
    setDeleteError('')
    try {
      await authRequest(`/api/panel-admin/resource-book-topic-tests/${deletingTest.id}`, { method: 'DELETE' })
      setDeletingTest(null)
      onChanged()
    } catch (err) {
      setDeleteError(err.message)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {canEdit ? (
        <Button type="button" size="sm" variant="secondary" className="w-fit gap-1.5" onClick={() => setTopicModalOpen(true)}>
          <Plus size={15} aria-hidden="true" />
          İçerik Ekle
        </Button>
      ) : null}

      {topics.length === 0 ? (
        <p className="p-2 text-sm text-panel-text-muted">Bu kaynağa henüz içerik eklenmemiş.</p>
      ) : (
        <div className="flex flex-col gap-2 rounded-xl border border-panel-border p-2">
          {topics.map((topic) => {
            const topicTests = testsByTopic.get(topic.id) || []
            const collapsed = expandedTopicId !== topic.id
            return (
              <div key={topic.id} className="py-0.5">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setExpandedTopicId(collapsed ? topic.id : null)}
                    className="flex flex-1 items-center gap-1.5 rounded-lg px-1.5 py-1.5 text-left text-sm font-medium text-panel-text hover:bg-panel-blue-soft"
                  >
                    {collapsed ? (
                      <ChevronRight size={14} className="shrink-0 text-panel-text-muted" />
                    ) : (
                      <ChevronDown size={14} className="shrink-0 text-panel-text-muted" />
                    )}
                    <span className="min-w-0 flex-1 truncate">{topic.name}</span>
                    <span className="text-[11px] font-medium text-panel-text-muted">{topicTests.length} test</span>
                  </button>
                  {canEdit ? (
                    <button
                      type="button"
                      aria-label="İçeriği düzenle"
                      onClick={() => setEditingTopic(topic)}
                      className="text-panel-text-muted hover:text-panel-blue"
                    >
                      <Pencil size={13} aria-hidden="true" />
                    </button>
                  ) : null}
                </div>

                {!collapsed ? (
                  <div className="ml-5 flex flex-col gap-1.5 pl-1">
                    {canEdit ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="w-fit gap-1.5"
                        onClick={() => setTestModalTopic(topic)}
                      >
                        <Plus size={14} aria-hidden="true" />
                        Test Ekle
                      </Button>
                    ) : null}
                    {topicTests.length === 0 ? (
                      <p className="py-1 text-xs text-panel-text-muted">
                        Bu içeriğe henüz test eklenmemiş. “Test Ekle” ile kitaptaki testleri girin.
                      </p>
                    ) : (
                      topicTests.map((test) => (
                        <div key={test.id} className="flex items-center gap-2 rounded-lg px-1.5 py-1 text-xs text-panel-text-muted">
                          <span className="min-w-0 flex-1 truncate">
                            {test.topicName ? `${test.topicName} · ` : ''}
                            {test.name} · s.{test.pageStart}
                            {test.pageEnd && test.pageEnd !== test.pageStart ? `-${test.pageEnd}` : ''}
                            {test.questionCount ? ` · ${test.questionCount} soru` : ''}
                          </span>
                          {canEdit ? (
                            <>
                              {showAnswerKey ? (
                                <button
                                  type="button"
                                  aria-label="Cevap anahtarı"
                                  title={test.hasAnswerKey ? 'Cevap anahtarı tam' : 'Cevap anahtarı eksik'}
                                  onClick={() => setAnswerKeyTest(test)}
                                  className={`hover:text-panel-text ${test.hasAnswerKey ? 'text-panel-text-muted' : 'text-panel-warm'}`}
                                >
                                  <KeyRound size={13} aria-hidden="true" />
                                </button>
                              ) : null}
                              <button
                                type="button"
                                aria-label="Testi düzenle"
                                onClick={() => setEditingTest(test)}
                                className="text-panel-text-muted hover:text-panel-blue"
                              >
                                <Pencil size={12} aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                aria-label="Testi sil"
                                onClick={() => {
                                  setDeleteError('')
                                  setDeletingTest(test)
                                }}
                                className="text-panel-text-muted hover:text-panel-warm"
                              >
                                <Trash2 size={12} aria-hidden="true" />
                              </button>
                            </>
                          ) : null}
                        </div>
                      ))
                    )}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      )}

      {topicModalOpen ? (
        <TopicModal
          book={book}
          topics={topics}
          tests={tests}
          onDeleted={() => onChanged()}
          onTestsCreated={() => onChanged()}
          onSaved={(topic) => {
            setTopicModalOpen(false)
            // Yeni içeriği hemen aç ki "Test Ekle" butonu görünür olsun.
            if (topic?.id) setExpandedTopicId(topic.id)
            onChanged()
          }}
          onClose={() => setTopicModalOpen(false)}
        />
      ) : null}
      {editingTopic ? (
        <TopicModal
          topic={editingTopic}
          book={book}
          topics={topics}
          tests={tests}
          onSaved={() => {
            setEditingTopic(null)
            onChanged()
          }}
          onClose={() => setEditingTopic(null)}
        />
      ) : null}
      {testModalTopic ? (
        <TestModal
          topic={{ ...testModalTopic, bookName: book?.name }}
          book={book}
          tests={tests}
          onSaved={() => {
            setTestModalTopic(null)
            onChanged()
          }}
          onClose={() => setTestModalTopic(null)}
        />
      ) : null}
      {editingTest ? (
        <TestModal
          test={editingTest}
          topic={topics.find((topic) => topic.id === editingTest.topicId)}
          onSaved={() => {
            setEditingTest(null)
            onChanged()
          }}
          onClose={() => setEditingTest(null)}
        />
      ) : null}
      {answerKeyTest ? (
        <AnswerKeyFlow
          test={answerKeyTest}
          // Soru sayısı girilince güncel test nesnesiyle yeniden render et → optik/cevap
          // anahtarı ekranı açılsın (aksi halde eski test.questionCount=null'da takılı kalıyordu).
          onTestUpdated={(updatedTest) => {
            if (updatedTest) setAnswerKeyTest(updatedTest)
            onChanged()
          }}
          onClose={() => {
            setAnswerKeyTest(null)
            onChanged()
          }}
        />
      ) : null}
      {deletingTest ? (
        <ConfirmationDialog
          title="Testi Sil"
          description={deleteError || `"${deletingTest.name}" testini silmek istediğinize emin misiniz?`}
          confirmLabel={deleting ? 'Siliniyor...' : 'Sil'}
          cancelLabel="Vazgeç"
          onConfirm={handleDeleteTest}
          onCancel={() => {
            if (deleting) return
            setDeletingTest(null)
            setDeleteError('')
          }}
        />
      ) : null}
    </div>
  )
}

function AssigneesTab({ book, onChanged }) {
  const [students, setStudents] = useState(null)
  const [assignedIds, setAssignedIds] = useState(
    () => new Set((book.assignedStudents || []).map((s) => String(s.id))),
  )
  const [savingIds, setSavingIds] = useState(() => new Set())
  const [error, setError] = useState('')

  useEffect(() => {
    let ignore = false
    getBookshelfStudents()
      .then((list) => {
        if (!ignore) setStudents(list)
      })
      .catch((err) => {
        if (!ignore) setError(err.message)
      })
    return () => {
      ignore = true
    }
  }, [])

  const toggle = async (studentId) => {
    const key = String(studentId)
    const next = new Set(assignedIds)
    if (next.has(key)) next.delete(key)
    else next.add(key)

    setSavingIds((current) => new Set(current).add(key))
    setError('')
    const previous = assignedIds
    setAssignedIds(next)
    try {
      await setBookshelfBookStudents(book.id, [...next])
      onChanged()
    } catch (err) {
      setAssignedIds(previous)
      setError(err.message)
    } finally {
      setSavingIds((current) => {
        const n = new Set(current)
        n.delete(key)
        return n
      })
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-panel-text-muted">
        Bu kaynağın hangi çocuk/öğrencilerin kitaplığında görüneceğini seçin.
        {book.otherAssignedCount > 0
          ? ` Ayrıca yönetmediğiniz ${book.otherAssignedCount} kişiye daha atanmış.`
          : ''}
      </p>
      {error ? <div className="rounded-xl bg-panel-accent-soft px-3 py-2 text-sm text-panel-warm">{error}</div> : null}
      {students === null ? (
        <LoadingState label="Öğrenciler yükleniyor..." />
      ) : students.length === 0 ? (
        <p className="p-2 text-sm text-panel-text-muted">Atama yapabileceğiniz çocuk/öğrenci yok.</p>
      ) : (
        <StudentPicker students={students} selectedIds={assignedIds} onToggle={toggle} savingIds={savingIds} />
      )}
    </div>
  )
}

export default function BookshelfDetailModal({ resourceBookId, showAssignees = true, onClose, onChanged, onEdit }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('content')
  const [previewImage, setPreviewImage] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [deleting, setDeleting] = useState(false)

  const load = () => {
    getBookshelfBook(resourceBookId)
      .then((result) => setData(result))
      .catch((err) => setError(err.message))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resourceBookId])

  const book = data?.resourceBook || null
  // Katalog kaynaklarında atama yönetilemez → "Atananlar" sekmesi gizlenir, yalnızca içerik gösterilir.
  const canShowAssignees = showAssignees && Boolean(book?.canManageAssignees)

  const handleDelete = async () => {
    setDeleting(true)
    setDeleteError('')
    try {
      await deleteBookshelfBook(resourceBookId)
      onChanged?.()
      onClose()
    } catch (err) {
      setDeleteError(err.message)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/30 p-0 sm:items-center sm:p-4">
      <div className="flex h-full w-full max-w-3xl flex-col overflow-hidden bg-panel-surface p-4 shadow-panel-1 sm:h-[86vh] sm:rounded-2xl sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            {book ? (
              <ResourceBookAvatar
                book={book}
                size="row"
                onClick={book.imageUrl ? () => setPreviewImage({ url: book.imageUrl, name: book.name }) : undefined}
              />
            ) : null}
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold text-panel-text">{book?.name || 'Kaynak'}</h2>
              <p className="text-xs text-panel-text-muted">
                {[book?.publisherName, book?.subjectName, book?.grade ? `${book.grade}. sınıf` : null, book ? BOOKSHELF_RESOURCE_TYPE_LABELS[book.type] : null]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {book?.canEditContent ? (
              <button type="button" aria-label="Kitabı düzenle" onClick={() => onEdit?.(book)} className="text-panel-text-muted hover:text-panel-blue">
                <Pencil size={16} aria-hidden="true" />
              </button>
            ) : null}
            {book?.canDelete ? (
              <button
                type="button"
                aria-label="Kitabı sil"
                onClick={() => {
                  setDeleteError('')
                  setConfirmDelete(true)
                }}
                className="text-panel-text-muted hover:text-panel-warm"
              >
                <Trash2 size={16} aria-hidden="true" />
              </button>
            ) : null}
            <button type="button" aria-label="Kapat" onClick={onClose} className="text-panel-text-muted hover:text-panel-text">
              <X size={20} />
            </button>
          </div>
        </div>

        {canShowAssignees ? (
          <div className="mb-4 flex gap-1 border-b border-panel-border">
            <button
              type="button"
              onClick={() => setTab('content')}
              className={`border-b-2 px-3 pb-2.5 text-sm font-semibold transition-colors ${
                tab === 'content' ? 'border-panel-blue text-panel-blue' : 'border-transparent text-panel-text-muted hover:text-panel-text'
              }`}
            >
              İçerik
            </button>
            <button
              type="button"
              onClick={() => setTab('assignees')}
              className={`border-b-2 px-3 pb-2.5 text-sm font-semibold transition-colors ${
                tab === 'assignees' ? 'border-panel-blue text-panel-blue' : 'border-transparent text-panel-text-muted hover:text-panel-text'
              }`}
            >
              Atananlar
            </button>
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto">
          {error ? (
            <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-sm text-panel-warm">{error}</div>
          ) : data === null ? (
            <LoadingState label="Yükleniyor..." />
          ) : tab === 'assignees' && canShowAssignees ? (
            <AssigneesTab book={book} onChanged={() => { load(); onChanged?.() }} />
          ) : (
            <ContentTab
              book={book}
              topics={data.topics}
              tests={data.tests}
              canEdit={Boolean(book?.canEditContent)}
              onChanged={() => { load(); onChanged?.() }}
            />
          )}
        </div>
      </div>

      {confirmDelete ? (
        <ConfirmationDialog
          title="Kitabı sil"
          description={
            deleteError || `"${book?.name}" kaynağını silmek istediğinize emin misiniz? Tüm atamalardan kaldırılır.`
          }
          confirmLabel={deleting ? 'Siliniyor...' : 'Sil'}
          cancelLabel="Vazgeç"
          onConfirm={handleDelete}
          onCancel={() => {
            if (deleting) return
            setConfirmDelete(false)
            setDeleteError('')
          }}
        />
      ) : null}

      <ImagePreviewLightbox preview={previewImage} onClose={() => setPreviewImage(null)} />
    </div>
  )
}
