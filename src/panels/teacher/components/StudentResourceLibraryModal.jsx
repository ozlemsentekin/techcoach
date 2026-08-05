import { useEffect, useState } from 'react'
import { ArrowLeft, BookOpen, Check, ChevronDown, ChevronRight, X } from 'lucide-react'
import Badge from '../../ui/Badge'
import LoadingState from '../../shared/LoadingState'
import { getTeacherResourceBooks, getTeacherResourceBookTopics } from '../../../services/teacherService'

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

function BookTopics({ studentTeacherId, book }) {
  const [topics, setTopics] = useState(null)
  const [error, setError] = useState('')
  const [collapsedTopicIds, setCollapsedTopicIds] = useState(new Set())

  useEffect(() => {
    let ignore = false

    getTeacherResourceBookTopics(studentTeacherId, book.id)
      .then((data) => {
        if (!ignore) setTopics(data)
      })
      .catch((err) => {
        if (!ignore) setError(err.message)
      })

    return () => {
      ignore = true
    }
  }, [studentTeacherId, book.id])

  const toggleTopicCollapsed = (topicId) => {
    setCollapsedTopicIds((prev) => {
      const next = new Set(prev)
      if (next.has(topicId)) next.delete(topicId)
      else next.add(topicId)
      return next
    })
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
                {topic.tests.map((test) => (
                  <div key={test.id} className="flex items-center gap-2 rounded-lg px-2 py-1 text-xs">
                    {test.completed ? (
                      <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm bg-panel-blue text-white">
                        <Check size={10} strokeWidth={3} />
                      </span>
                    ) : (
                      <span className="h-3.5 w-3.5 shrink-0 rounded-sm border border-panel-border" />
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
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

export default function StudentResourceLibraryModal({ student, onClose }) {
  const [resourceBooks, setResourceBooks] = useState(null)
  const [error, setError] = useState('')
  const [selectedBook, setSelectedBook] = useState(null)

  useEffect(() => {
    let ignore = false

    getTeacherResourceBooks(student.studentTeacherId)
      .then((data) => {
        if (!ignore) setResourceBooks(data)
      })
      .catch((err) => {
        if (!ignore) setError(err.message)
      })

    return () => {
      ignore = true
    }
  }, [student.studentTeacherId])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col panel-card p-6">
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
              <h2 className="truncate text-base font-semibold text-panel-text">
                {selectedBook ? selectedBook.name : `${student.studentFullName} · Kaynaklar`}
              </h2>
              {selectedBook?.publisherName ? (
                <p className="text-xs text-panel-text-muted">{selectedBook.publisherName}</p>
              ) : null}
            </div>
          </div>
          <button type="button" aria-label="Kapat" onClick={onClose} className="shrink-0">
            <X size={20} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {selectedBook ? (
            <BookTopics key={selectedBook.id} studentTeacherId={student.studentTeacherId} book={selectedBook} />
          ) : error ? (
            <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-sm text-panel-warm">{error}</div>
          ) : resourceBooks === null ? (
            <LoadingState label="Kaynaklar yükleniyor..." />
          ) : resourceBooks.length === 0 ? (
            <p className="p-2 text-sm text-panel-text-muted">Bu öğrenci için takip edilen kaynak yok.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {resourceBooks.map((book) => (
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
                    {book.subjectName ? <p className="truncate text-xs text-panel-text-muted">{book.subjectName}</p> : null}
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
