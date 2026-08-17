import { useEffect, useState } from 'react'
import { ArrowLeft, BookOpen, Check, ChevronDown, ChevronRight, Plus, Trash2, X } from 'lucide-react'
import Badge from '../../ui/Badge'
import Button from '../../ui/Button'
import LoadingState from '../../shared/LoadingState'
import ConfirmationDialog from '../../shared/ConfirmationDialog'
import { authRequest } from '../../../services/authClient'
import StudentResourceAssignModal from './StudentResourceAssignModal'

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

function ResourceBookAvatar({ book, size = 'md' }) {
  const dimension = size === 'lg' ? 'h-14 w-14' : 'h-10 w-10'
  if (book?.imageUrl) {
    return (
      <img
        src={book.imageUrl}
        alt={`${book.name} görseli`}
        className={`${dimension} shrink-0 rounded-lg border border-panel-border object-cover`}
      />
    )
  }

  return (
    <span className={`flex ${dimension} shrink-0 items-center justify-center rounded-lg bg-panel-blue-soft text-panel-blue`}>
      <BookOpen size={size === 'lg' ? 22 : 17} aria-hidden="true" />
    </span>
  )
}

function BookTopics({ student, book }) {
  const [topics, setTopics] = useState(null)
  const [error, setError] = useState('')
  const [collapsedTopicIds, setCollapsedTopicIds] = useState(new Set())
  const [savingTestIds, setSavingTestIds] = useState(new Set())
  const [rowErrors, setRowErrors] = useState({})

  useEffect(() => {
    let ignore = false

    authRequest(`/api/panel/resource-book-topics?resourceBookId=${book.id}&studentId=${student.id}`)
      .then((data) => {
        if (!ignore) {
          setTopics(data.topics)
          setCollapsedTopicIds(new Set(data.topics.map((topic) => topic.id)))
        }
      })
      .catch((err) => {
        if (!ignore) setError(err.message)
      })

    return () => {
      ignore = true
    }
  }, [student.id, book.id])

  const toggleTopicCollapsed = (topicId) => {
    setCollapsedTopicIds((prev) => {
      const next = new Set(prev)
      if (next.has(topicId)) next.delete(topicId)
      else next.add(topicId)
      return next
    })
  }

  const applyCompletionSource = (testId, completionSource) => {
    setTopics((current) =>
      current.map((topic) => ({
        ...topic,
        tests: topic.tests.map((test) =>
          test.id === testId ? { ...test, completed: Boolean(completionSource), completionSource } : test,
        ),
      })),
    )
  }

  const toggleManualCompletion = async (test) => {
    if (savingTestIds.has(test.id)) return

    const wasManual = test.completionSource === 'manual'
    const previousSource = test.completionSource

    setSavingTestIds((prev) => new Set(prev).add(test.id))
    setRowErrors((prev) => {
      const next = { ...prev }
      delete next[test.id]
      return next
    })

    // Optimistic update: kullanıcı isteğin sonucunu beklemeden anında tepki görsün.
    applyCompletionSource(test.id, wasManual ? null : 'manual')

    try {
      if (wasManual) {
        await authRequest(`/api/panel/resource-book-topic-tests/${test.id}/completion?studentId=${student.id}`, {
          method: 'DELETE',
        })
      } else {
        await authRequest(`/api/panel/resource-book-topic-tests/${test.id}/completion?studentId=${student.id}`, {
          method: 'PUT',
        })
      }
    } catch (err) {
      applyCompletionSource(test.id, previousSource)
      setRowErrors((prev) => ({ ...prev, [test.id]: err.message }))
    } finally {
      setSavingTestIds((prev) => {
        const next = new Set(prev)
        next.delete(test.id)
        return next
      })
    }
  }

  if (error) {
    return <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-sm text-panel-warm">{error}</div>
  }

  if (topics === null) {
    return <LoadingState label="İçerikler yükleniyor..." />
  }

  if (topics.length === 0) {
    return <p className="p-2 text-sm text-panel-text-muted">Bu kaynağa ait içerik yok.</p>
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-panel-text-muted">
        Bir testin kutusuna tıklayarak tamamlandı olarak işaretleyebilir veya işareti kaldırabilirsiniz —
        değişiklik anında kaydedilir, ayrı bir kaydet adımı gerekmez.
      </p>
      <div className="flex flex-col rounded-xl border border-panel-border p-2">
        {topics.map((topic) => {
          const isCollapsed = collapsedTopicIds.has(topic.id)
          return (
            <div key={topic.id} className="py-0.5">
              <button
                type="button"
                onClick={() => toggleTopicCollapsed(topic.id)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-panel-blue-soft"
              >
                {isCollapsed ? (
                  <ChevronRight size={14} className="shrink-0 text-panel-text-muted" />
                ) : (
                  <ChevronDown size={14} className="shrink-0 text-panel-text-muted" />
                )}
                <span className="font-medium text-panel-text">{topic.name}</span>
              </button>
              {topic.tests.length && !isCollapsed ? (
                <div className="ml-6 flex flex-col">
                  {topic.tests.map((test) => {
                    const isGraded = test.completionSource === 'graded'
                    const isSaving = savingTestIds.has(test.id)
                    return (
                      <div key={test.id} className="relative rounded-lg px-2 py-1">
                        <div className="flex items-center gap-2 text-xs">
                          {isGraded ? (
                            <span
                              className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm bg-panel-blue text-white"
                              title="Dijital olarak değerlendirilmiş"
                            >
                              <Check size={10} strokeWidth={3} />
                            </span>
                          ) : (
                            <button
                              type="button"
                              disabled={isSaving}
                              onClick={() => toggleManualCompletion(test)}
                              title={
                                rowErrors[test.id]
                                  ? rowErrors[test.id]
                                  : test.completionSource === 'manual'
                                    ? 'İşareti kaldır'
                                    : 'Tamamlandı olarak işaretle'
                              }
                              className={`-m-1.5 flex h-6.5 w-6.5 shrink-0 items-center justify-center rounded-sm p-1.5 disabled:opacity-50`}
                            >
                              <span
                                className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border transition-colors ${
                                  rowErrors[test.id]
                                    ? 'border-panel-warm'
                                    : test.completionSource === 'manual'
                                      ? 'border-panel-blue bg-panel-blue text-white'
                                      : 'border-panel-border bg-white hover:border-panel-blue'
                                }`}
                              >
                                {test.completionSource === 'manual' ? <Check size={10} strokeWidth={3} /> : null}
                              </span>
                            </button>
                          )}
                          <span className="flex min-w-0 items-center gap-1.5 text-panel-text-muted">
                            {test.topicName ? (
                              <Badge tone="slate" className="shrink-0">
                                {test.topicName}
                              </Badge>
                            ) : null}
                            <span className="truncate">
                              {test.name} · s.{test.pageStart}-{test.pageEnd} · {test.questionCount} soru
                            </span>
                            {test.completionSource === 'manual' ? (
                              <Badge tone="lilac" className="shrink-0">
                                Elle işaretlendi
                              </Badge>
                            ) : null}
                          </span>
                        </div>
                        {rowErrors[test.id] ? (
                          <span className="absolute left-5.5 top-full z-10 whitespace-nowrap rounded-md border border-panel-border bg-white px-2 py-1 text-[11px] text-panel-warm shadow-sm">
                            {rowErrors[test.id]}
                          </span>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
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

  const title = selectedBook ? selectedBook.name : `${student.fullName} · Kaynaklar`

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-2 sm:p-4">
      <div className="flex h-full max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden panel-card p-4 sm:h-[88vh] sm:p-6">
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
              {selectedBook?.publisherName ? (
                <p className="text-xs text-panel-text-muted">{selectedBook.publisherName}</p>
              ) : !selectedBook ? (
                <p className="text-xs text-panel-text-muted">{student.fullName}</p>
              ) : null}
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

        <div className="min-h-0 flex-1 overflow-y-auto">
          {selectedBook ? (
            <BookTopics key={selectedBook.id} student={student} book={selectedBook} />
          ) : error ? (
            <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-sm text-panel-warm">{error}</div>
          ) : resourceBooks === null ? (
            <LoadingState label="Kaynaklar yükleniyor..." />
          ) : resourceBooks.length === 0 ? (
            <p className="p-2 text-sm text-panel-text-muted">Bu öğrenci için atanmış kaynak yok.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
                  className="relative flex cursor-pointer items-center gap-3 rounded-xl border border-panel-border p-3 pr-10 text-left hover:border-panel-blue"
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
                  <ResourceBookAvatar book={book} size="lg" />
                  <div className="min-w-0">
                    {book.publisherName ? (
                      <Badge tone="lilac" className="mb-1 w-fit">
                        {book.publisherName}
                      </Badge>
                    ) : null}
                    <p className="truncate text-sm font-semibold text-panel-text">{book.name}</p>
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
    </div>
  )
}
