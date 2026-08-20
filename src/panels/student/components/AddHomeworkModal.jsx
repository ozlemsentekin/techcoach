import { useEffect, useState } from 'react'
import { Check, ChevronDown, ChevronRight, Loader2, X } from 'lucide-react'
import { authRequest } from '../../../services/authClient'
import { todayISODate } from '../../../utils/time'
import Badge from '../../ui/Badge'
import ResourceBookSelect from '../../shared/homework/ResourceBookSelect'

function buildNote(resourceBookName, topics, selectedTestIds) {
  const lines = []
  topics?.forEach((topic) => {
    const selectedTests = topic.tests.filter((test) => selectedTestIds.has(test.id))
    if (selectedTests.length) {
      lines.push(`${topic.name}: ${selectedTests.map((test) => test.name).join(', ')}`)
    }
  })

  if (!lines.length) return ''
  return [resourceBookName, ...lines.map((line) => `- ${line}`)].filter(Boolean).join('\n')
}

function sumSelectedQuestions(topics, selectedTestIds) {
  let total = 0
  topics?.forEach((topic) => {
    topic.tests.forEach((test) => {
      if (selectedTestIds.has(test.id)) total += test.questionCount
    })
  })
  return total
}

export default function AddHomeworkModal({ onSave, onClose, defaultTaskDate }) {
  const [subject, setSubject] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [resourceBookId, setResourceBookId] = useState('')
  const [note, setNote] = useState('')
  const [totalQuestionCount, setTotalQuestionCount] = useState(0)
  const [totalPageCount, setTotalPageCount] = useState(0)
  const [taskDate, setTaskDate] = useState(defaultTaskDate || '')
  const [taskTime, setTaskTime] = useState('')
  const [subjects, setSubjects] = useState(null)
  const [subjectsError, setSubjectsError] = useState('')
  const [resourceBooks, setResourceBooks] = useState(null)
  const [resourceBooksError, setResourceBooksError] = useState('')
  const [topics, setTopics] = useState(null)
  const [topicsError, setTopicsError] = useState('')
  const [selectedTestIds, setSelectedTestIds] = useState(new Set())
  const [collapsedTopicIds, setCollapsedTopicIds] = useState(new Set())
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    let ignore = false

    authRequest('/api/panel/subjects', { method: 'GET' })
      .then((data) => {
        if (ignore) return
        setSubjects(data.subjects)
        if (data.subjects?.length) {
          setSubject((current) => current || data.subjects[0].name)
          setSubjectId((current) => current || data.subjects[0].id)
        }
      })
      .catch((err) => {
        if (!ignore) setSubjectsError(err.message)
      })

    return () => {
      ignore = true
    }
  }, [])

  useEffect(() => {
    if (!subjectId) return undefined

    let ignore = false
    setResourceBooks(null)
    setResourceBooksError('')

    authRequest(`/api/panel/resource-books?subjectId=${subjectId}`, { method: 'GET' })
      .then((data) => {
        if (!ignore) setResourceBooks(data.resourceBooks)
      })
      .catch((err) => {
        if (!ignore) setResourceBooksError(err.message)
      })

    return () => {
      ignore = true
    }
  }, [subjectId])

  useEffect(() => {
    if (!resourceBookId) return undefined

    let ignore = false

    authRequest(`/api/panel/resource-book-topics?resourceBookId=${resourceBookId}`, { method: 'GET' })
      .then((data) => {
        if (!ignore) setTopics(data.topics)
      })
      .catch((err) => {
        if (!ignore) setTopicsError(err.message)
      })

    return () => {
      ignore = true
    }
  }, [resourceBookId])

  const resourceBookType = resourceBooks?.find((book) => book.id === resourceBookId)?.type
  const isReadingBook = resourceBookType === 'okuma_kitabi'

  useEffect(() => {
    if (isReadingBook) return
    const resourceBookName = resourceBooks?.find((book) => book.id === resourceBookId)?.name || ''
    setNote(buildNote(resourceBookName, topics, selectedTestIds))
    setTotalQuestionCount(sumSelectedQuestions(topics, selectedTestIds))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTestIds, topics, isReadingBook])

  useEffect(() => {
    if (!isReadingBook) return
    setNote(totalPageCount ? `${totalPageCount} Sayfa okunacak` : '')
  }, [isReadingBook, totalPageCount])

  const handleSubjectChange = (event) => {
    const nextSubjectId = event.target.value
    const nextSubject = subjects?.find((item) => item.id === nextSubjectId)
    setSubjectId(nextSubjectId)
    setSubject(nextSubject?.name || '')
    setResourceBookId('')
    setResourceBooks(null)
    setTopics(null)
    setSelectedTestIds(new Set())
    setCollapsedTopicIds(new Set())
  }

  const handleResourceBookChange = (event) => {
    setResourceBookId(event.target.value)
    setTopics(null)
    setSelectedTestIds(new Set())
    setCollapsedTopicIds(new Set())
    setTotalPageCount(0)
  }

  const toggleTopicCollapsed = (topicId) => {
    setCollapsedTopicIds((prev) => {
      const next = new Set(prev)
      if (next.has(topicId)) next.delete(topicId)
      else next.add(topicId)
      return next
    })
  }

  const toggleTest = (testId) => {
    setSelectedTestIds((prev) => {
      const next = new Set(prev)
      if (next.has(testId)) next.delete(testId)
      else next.add(testId)
      return next
    })
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (saving) return
    const trimmedNote = note.trim()
    if (!resourceBookId) {
      setSaveError('Ödev için öğrenciye atanmış bir kaynak seçmelisiniz.')
      return
    }
    if (!subject.trim() || !trimmedNote) return

    const assignedDate = todayISODate()

    setSaving(true)
    setSaveError('')
    try {
      await onSave({
        subject: subject.trim(),
        subjectId: subjectId || undefined,
        resourceBookId: resourceBookId || undefined,
        testIds: resourceBookId ? Array.from(selectedTestIds) : undefined,
        title: trimmedNote.slice(0, 200),
        description: trimmedNote,
        assignedDate,
        dueDate: taskDate || assignedDate,
        totalQuestionCount: Number(totalQuestionCount) || 0,
        totalPageCount: isReadingBook ? Number(totalPageCount) || 0 : undefined,
        taskDate: taskDate || undefined,
        taskTime: taskDate ? taskTime || '00:00' : undefined,
      })
    } catch (err) {
      setSaveError(err.message || 'Bir hata oluştu, tekrar deneyin.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/30 p-0 sm:items-center sm:p-4">
      <form
        onSubmit={handleSubmit}
        className="h-full w-full max-w-3xl overflow-y-auto border border-panel-border bg-panel-surface p-4 shadow-panel-1 sm:h-auto sm:max-h-[90vh] sm:rounded-2xl sm:p-6"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-panel-text">Ödev Ekle</h2>
          <button type="button" aria-label="Kapat" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-panel-text-muted">Ders</span>
            <select
              required
              value={subjectId}
              onChange={handleSubjectChange}
              disabled={!subjects?.length}
              className="rounded-xl border border-panel-border p-3 text-sm text-panel-text"
            >
              <option value="" disabled>
                {subjects === null ? 'Dersler yükleniyor...' : 'Ders seçin'}
              </option>
              {subjects?.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            {subjectsError ? <span className="text-xs text-panel-warm">{subjectsError}</span> : null}
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-panel-text-muted">Kaynak</span>
            <ResourceBookSelect
              resourceBooks={resourceBooks}
              value={resourceBookId}
              onChange={(bookId) => handleResourceBookChange({ target: { value: bookId } })}
              disabled={!subjectId || !resourceBooks?.length}
              placeholder={
                !subjectId
                  ? 'Önce ders seçin'
                  : resourceBooks === null
                    ? 'Kaynaklar yükleniyor...'
                    : resourceBooks.length === 0
                      ? 'Bu derse atanmış kaynak yok'
                      : 'Kaynak seçin'
              }
            />
            {resourceBooksError ? <span className="text-xs text-panel-warm">{resourceBooksError}</span> : null}
          </label>

          {resourceBookId && !isReadingBook ? (
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-panel-text-muted">İçerik ve testler (isteğe bağlı, birden fazla seçilebilir)</span>
              <div className="max-h-72 overflow-y-auto rounded-xl border border-panel-border p-2 sm:max-h-64">
                {topics === null ? (
                  <p className="p-2 text-xs text-panel-text-muted">İçerikler yükleniyor...</p>
                ) : topics.length === 0 ? (
                  <p className="p-2 text-xs text-panel-text-muted">Bu kaynağa ait içerik yok</p>
                ) : (
                  topics.map((topic) => {
                    const isCollapsed = collapsedTopicIds.has(topic.id)
                    return (
                      <div key={topic.id} className="py-0.5">
                        <button
                          type="button"
                          onClick={() => toggleTopicCollapsed(topic.id)}
                          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-student-theme-soft"
                        >
                          {isCollapsed ? (
                            <ChevronRight size={14} className="shrink-0 text-panel-text-muted" />
                          ) : (
                            <ChevronDown size={14} className="shrink-0 text-panel-text-muted" />
                          )}
                          <span className="min-w-0 flex-1 font-medium text-panel-text">{topic.name}</span>
                        </button>
                        {topic.tests.length && !isCollapsed ? (
                          <div className="ml-0 flex flex-col sm:ml-6">
                            {topic.tests.map((test) => (
                              <label
                                key={test.id}
                                className={`flex items-start gap-2 rounded-lg px-2 py-1.5 text-xs sm:items-center ${
                                  test.completed
                                    ? 'cursor-not-allowed opacity-50'
                                    : test.assignedPending
                                      ? 'bg-panel-accent-soft hover:bg-panel-accent-soft/80'
                                      : 'hover:bg-student-theme-soft'
                                }`}
                              >
                                {test.completed ? (
                                  <span className="mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm bg-student-theme-primary text-student-theme-button-text sm:mt-0">
                                    <Check size={10} strokeWidth={3} />
                                  </span>
                                ) : (
                                  <input
                                    type="checkbox"
                                    checked={selectedTestIds.has(test.id)}
                                    onChange={() => toggleTest(test.id)}
                                    className="mt-0.5 sm:mt-0"
                                  />
                                )}
                                <span className="flex min-w-0 flex-1 flex-col gap-1 text-panel-text-muted sm:flex-row sm:items-center sm:gap-1.5">
                                  {test.topicName ? (
                                    <Badge tone="slate" className="w-fit max-w-full shrink-0 truncate">
                                      {test.topicName}
                                    </Badge>
                                  ) : null}
                                  <span className="line-clamp-2 sm:truncate">
                                    {test.name} · s.{test.pageStart}-{test.pageEnd} · {test.questionCount} soru
                                  </span>
                                </span>
                              </label>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    )
                  })
                )}
              </div>
              {topicsError ? <span className="text-xs text-panel-warm">{topicsError}</span> : null}
            </label>
          ) : null}

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-panel-text-muted">Ödev Notu</span>
            <textarea
              required
              rows={3}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="örn. Sayfa 40-42 arası sorular"
              className="rounded-xl border border-panel-border p-3 text-sm text-panel-text"
            />
          </label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-panel-text-muted">Tarih (isteğe bağlı)</span>
              <div className="flex flex-col gap-2 min-[420px]:flex-row">
                <input
                  type="date"
                  value={taskDate}
                  onChange={(event) => setTaskDate(event.target.value)}
                  className="min-w-0 flex-1 rounded-xl border border-panel-border p-3 text-sm text-panel-text"
                />
                <input
                  type="time"
                  value={taskTime}
                  onChange={(event) => setTaskTime(event.target.value)}
                  disabled={!taskDate}
                  className="w-full shrink-0 rounded-xl border border-panel-border p-3 text-sm text-panel-text disabled:opacity-60 min-[420px]:w-28"
                />
              </div>
              <span className="text-xs text-panel-text-muted">
                Seçilirse o gün için görev oluşturulur, seçilmezse ödev yalnızca listede görünür. Saat seçilmezse 00:00 olarak eklenir.
              </span>
            </label>

            {isReadingBook ? (
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-panel-text-muted">Sayfa Sayısı</span>
                <input
                  type="number"
                  min="0"
                  value={totalPageCount}
                  onChange={(event) => setTotalPageCount(event.target.value)}
                  className="rounded-xl border border-panel-border p-3 text-sm text-panel-text"
                />
              </label>
            ) : (
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-panel-text-muted">Toplam soru sayısı</span>
                <input
                  type="number"
                  min="0"
                  value={totalQuestionCount}
                  onChange={(event) => setTotalQuestionCount(event.target.value)}
                  className="rounded-xl border border-panel-border p-3 text-sm text-panel-text"
                />
              </label>
            )}
          </div>

          {saveError ? <span className="text-xs text-panel-warm">{saveError}</span> : null}

          <button
            type="submit"
            disabled={saving || !resourceBookId}
            className="flex items-center justify-center gap-2 rounded-xl bg-student-theme-primary px-4 py-3 text-sm font-semibold text-student-theme-button-text hover:bg-student-theme-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-student-theme-primary disabled:cursor-not-allowed disabled:opacity-70"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : null}
            {saving ? 'Kaydediliyor...' : 'Ödevi Kaydet'}
          </button>
        </div>
      </form>
    </div>
  )
}
