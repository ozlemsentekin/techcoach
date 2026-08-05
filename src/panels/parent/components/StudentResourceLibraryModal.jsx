import { useEffect, useState } from 'react'
import { ArrowLeft, BookOpen, Check, ChevronDown, ChevronRight, GraduationCap, X } from 'lucide-react'
import Badge from '../../ui/Badge'
import LoadingState from '../../shared/LoadingState'
import { authRequest } from '../../../services/authClient'

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
    setSavingTestIds((prev) => new Set(prev).add(test.id))
    setRowErrors((prev) => {
      const next = { ...prev }
      delete next[test.id]
      return next
    })

    try {
      if (test.completionSource === 'manual') {
        await authRequest(`/api/panel/resource-book-topic-tests/${test.id}/completion?studentId=${student.id}`, {
          method: 'DELETE',
        })
        applyCompletionSource(test.id, null)
      } else {
        await authRequest(`/api/panel/resource-book-topic-tests/${test.id}/completion?studentId=${student.id}`, {
          method: 'PUT',
        })
        applyCompletionSource(test.id, 'manual')
      }
    } catch (err) {
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
                      <div key={test.id} className="flex flex-col gap-0.5 rounded-lg px-2 py-1">
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
                              title={test.completionSource === 'manual' ? 'İşareti kaldır' : 'Tamamlandı olarak işaretle'}
                              className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border transition-colors disabled:opacity-50 ${
                                test.completionSource === 'manual'
                                  ? 'border-panel-blue bg-panel-blue text-white'
                                  : 'border-panel-border bg-white hover:border-panel-blue'
                              }`}
                            >
                              {test.completionSource === 'manual' ? <Check size={10} strokeWidth={3} /> : null}
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
                          <span className="pl-5.5 text-[11px] text-panel-warm">{rowErrors[test.id]}</span>
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
  const [selectedSubject, setSelectedSubject] = useState(null)
  const [selectedBook, setSelectedBook] = useState(null)

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

  const handleBack = () => {
    if (selectedBook) {
      setSelectedBook(null)
    } else if (selectedSubject) {
      setSelectedSubject(null)
    }
  }

  const title = selectedBook
    ? selectedBook.name
    : selectedSubject
      ? selectedSubject.name
      : `${student.fullName} · İçerik Takibi`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden panel-card p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            {selectedBook || selectedSubject ? (
              <button
                type="button"
                onClick={handleBack}
                aria-label="Geri dön"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-panel-text-muted hover:bg-panel-surface-soft"
              >
                <ArrowLeft size={18} aria-hidden="true" />
              </button>
            ) : null}
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold text-panel-text">{title}</h2>
              {selectedBook?.publisherName ? (
                <p className="text-xs text-panel-text-muted">{selectedBook.publisherName}</p>
              ) : selectedSubject ? (
                <p className="text-xs text-panel-text-muted">{student.fullName}</p>
              ) : null}
            </div>
          </div>
          <button type="button" aria-label="Kapat" onClick={onClose} className="shrink-0">
            <X size={20} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {selectedBook ? (
            <BookTopics key={selectedBook.id} student={student} book={selectedBook} />
          ) : error ? (
            <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-sm text-panel-warm">{error}</div>
          ) : resourceBooks === null ? (
            <LoadingState label="Kaynaklar yükleniyor..." />
          ) : resourceBooks.length === 0 ? (
            <p className="p-2 text-sm text-panel-text-muted">Bu öğrenci için atanmış kaynak yok.</p>
          ) : selectedSubject ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {selectedSubject.books.map((book) => (
                <button
                  key={book.id}
                  type="button"
                  onClick={() => setSelectedBook(book)}
                  className="flex items-center gap-3 rounded-xl border border-panel-border p-3 text-left hover:border-panel-blue"
                >
                  <ResourceBookAvatar book={book} size="lg" />
                  <div className="min-w-0">
                    {book.publisherName ? (
                      <Badge tone="lilac" className="mb-1 w-fit">
                        {book.publisherName}
                      </Badge>
                    ) : null}
                    <p className="truncate text-sm font-semibold text-panel-text">{book.name}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {subjectGroups.map((subject) => (
                <button
                  key={subject.id}
                  type="button"
                  onClick={() => setSelectedSubject(subject)}
                  className="flex items-center gap-3 rounded-xl border border-panel-border p-3 text-left hover:border-panel-blue"
                >
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-panel-blue-soft text-panel-blue">
                    <GraduationCap size={22} aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-panel-text">{subject.name}</p>
                    <p className="truncate text-xs text-panel-text-muted">{subject.books.length} kaynak</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
