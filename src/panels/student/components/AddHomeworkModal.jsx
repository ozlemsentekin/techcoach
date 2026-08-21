import { useEffect, useState } from 'react'
import { Check, ChevronDown, ChevronRight, Loader2, X } from 'lucide-react'
import { authRequest } from '../../../services/authClient'
import { todayISODate } from '../../../utils/time'
import Badge from '../../ui/Badge'
import { cn } from '../../ui/utils'
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

export default function AddHomeworkModal({ onSave, onClose, defaultTaskDate, panelRole = 'student' }) {
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

  const selectedBook = resourceBooks?.find((book) => book.id === resourceBookId) || null
  const resourceBookType = selectedBook?.type
  const isReadingBook = resourceBookType === 'okuma_kitabi'
  const isStudentPanel = panelRole === 'student'
  const selectedTestCount = selectedTestIds.size
  const selectedSummary = isReadingBook
    ? totalPageCount
      ? `${totalPageCount} sayfa`
      : 'Sayfa girin'
    : selectedTestCount
      ? `${selectedTestCount} test · ${totalQuestionCount} soru`
      : topics === null
        ? 'Yükleniyor'
        : topics?.length
          ? `${topics.length} konu`
          : 'Test yok'
  const topicHoverClass = isStudentPanel ? 'hover:bg-student-theme-soft' : 'hover:bg-panel-warm-soft/70'
  const completedCheckClass = isStudentPanel
    ? 'bg-student-theme-primary text-student-theme-button-text'
    : 'bg-panel-warm text-white'
  const checkboxClass = isStudentPanel ? 'accent-student-theme-primary' : 'accent-panel-warm'
  const primaryButtonClass = isStudentPanel
    ? 'bg-student-theme-primary text-student-theme-button-text hover:bg-student-theme-hover focus-visible:outline-student-theme-primary'
    : 'bg-panel-warm text-white hover:bg-panel-warm/90 focus-visible:outline-panel-warm'

  useEffect(() => {
    if (isReadingBook) return
    setNote(buildNote(selectedBook?.name || '', topics, selectedTestIds))
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
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-hidden bg-black/30 p-0 sm:items-center sm:p-4">
      <form
        onSubmit={handleSubmit}
        className="flex h-full w-full max-w-3xl flex-col overflow-hidden border border-panel-border bg-panel-surface shadow-panel-1 sm:h-auto sm:max-h-[90vh] sm:rounded-2xl"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-panel-border px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-panel-text">Ödev Ekle</h2>
            <p className="mt-0.5 truncate text-xs text-panel-text-muted">{selectedBook?.name || 'Ders ve kaynak seçin'}</p>
          </div>
          <button
            type="button"
            aria-label="Kapat"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-panel-text-muted hover:bg-panel-surface-soft hover:text-panel-text"
          >
            <X size={20} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-panel-text-muted">Ders</span>
              <select
                required
                value={subjectId}
                onChange={handleSubjectChange}
                disabled={!subjects?.length}
                className="h-12 rounded-xl border border-panel-border bg-panel-surface px-3 text-sm text-panel-text"
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
                variant={isStudentPanel ? 'student' : 'panel'}
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
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-panel-text-muted">Testler</span>
                  <Badge tone={isStudentPanel ? 'blue' : 'warm'} className="shrink-0">
                    {selectedSummary}
                  </Badge>
                </div>
                <div className="max-h-[38dvh] overflow-y-auto rounded-xl border border-panel-border p-1.5 sm:max-h-64">
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
                            className={cn(
                              'flex w-full min-w-0 items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors',
                              topicHoverClass,
                            )}
                          >
                            {isCollapsed ? (
                              <ChevronRight size={14} className="shrink-0 text-panel-text-muted" />
                            ) : (
                              <ChevronDown size={14} className="shrink-0 text-panel-text-muted" />
                            )}
                            <span className="min-w-0 flex-1 truncate font-semibold text-panel-text">{topic.name}</span>
                            <span className="shrink-0 text-[11px] font-medium text-panel-text-muted">{topic.tests.length} test</span>
                          </button>
                          {topic.tests.length && !isCollapsed ? (
                            <div className="flex flex-col gap-1 pt-1 sm:ml-6">
                              {topic.tests.map((test) => (
                                <label
                                  key={test.id}
                                  className={cn(
                                    'flex min-w-0 items-center gap-2 rounded-lg px-2 py-2 text-xs transition-colors',
                                    test.completed
                                      ? 'cursor-not-allowed opacity-50'
                                      : test.assignedPending
                                        ? 'bg-panel-accent-soft hover:bg-panel-accent-soft/80'
                                        : topicHoverClass,
                                  )}
                                >
                                  {test.completed ? (
                                    <span className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded-sm', completedCheckClass)}>
                                      <Check size={10} strokeWidth={3} />
                                    </span>
                                  ) : (
                                    <input
                                      type="checkbox"
                                      checked={selectedTestIds.has(test.id)}
                                      onChange={() => toggleTest(test.id)}
                                      className={cn('h-4 w-4 shrink-0', checkboxClass)}
                                    />
                                  )}
                                  <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-medium text-panel-text">{test.name}</span>
                                    <span className="mt-0.5 block truncate text-xs text-panel-text-muted">
                                      s.{test.pageStart}-{test.pageEnd} · {test.questionCount} soru
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
              </div>
            ) : null}

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-panel-text-muted">Ödev Notu</span>
              <textarea
                required
                rows={2}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="örn. Sayfa 40-42 arası sorular"
                className="min-h-20 rounded-xl border border-panel-border bg-panel-surface p-3 text-sm text-panel-text"
              />
            </label>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-panel-text-muted">Planlama</span>
                <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-[minmax(0,1fr)_8rem]">
                  <input
                    aria-label="Tarih"
                    type="date"
                    value={taskDate}
                    onChange={(event) => setTaskDate(event.target.value)}
                    className="min-w-0 rounded-xl border border-panel-border bg-panel-surface p-3 text-sm text-panel-text"
                  />
                  <input
                    aria-label="Saat"
                    type="time"
                    value={taskTime}
                    onChange={(event) => setTaskTime(event.target.value)}
                    disabled={!taskDate}
                    className="min-w-0 rounded-xl border border-panel-border bg-panel-surface p-3 text-sm text-panel-text disabled:opacity-60"
                  />
                </div>
              </div>

              {isReadingBook ? (
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-panel-text-muted">Sayfa Sayısı</span>
                  <input
                    type="number"
                    min="0"
                    value={totalPageCount}
                    onChange={(event) => setTotalPageCount(event.target.value)}
                    className="rounded-xl border border-panel-border bg-panel-surface p-3 text-sm text-panel-text"
                  />
                </label>
              ) : (
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-panel-text-muted">Toplam Soru</span>
                  <input
                    type="number"
                    min="0"
                    value={totalQuestionCount}
                    onChange={(event) => setTotalQuestionCount(event.target.value)}
                    className="rounded-xl border border-panel-border bg-panel-surface p-3 text-sm text-panel-text"
                  />
                </label>
              )}
            </div>
          </div>
        </div>

        <div
          className="shrink-0 border-t border-panel-border bg-panel-surface px-4 py-3 sm:px-6"
          style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
        >
          {saveError ? <p className="mb-2 text-xs text-panel-warm">{saveError}</p> : null}
          <button
            type="submit"
            disabled={saving || !resourceBookId}
            className={cn(
              'flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-70',
              primaryButtonClass,
            )}
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : null}
            {saving ? 'Kaydediliyor...' : 'Ödevi Kaydet'}
          </button>
        </div>
      </form>
    </div>
  )
}
