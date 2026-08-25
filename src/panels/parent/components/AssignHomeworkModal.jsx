import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ListChecks,
  Loader2,
  Search,
  X,
  XCircle,
} from 'lucide-react'
import { authRequest } from '../../../services/authClient'
import { getPanelHomeworkResourceBooks } from '../../../services/resourceBookService'
import { getSchoolScheduleConflict } from '../../../services/weeklyPlanService'
import { addMinutesToTime, todayISODate } from '../../../utils/time'
import Badge from '../../ui/Badge'
import LoadingState from '../../shared/LoadingState'
import { ResourceBookRates } from '../../shared/ResourceBookCard'
import { filterTopicsBySearch } from '../../shared/homework/topicSearch'
import { cn } from '../../ui/utils'

const DEFAULT_TASK_DURATION_MINUTES = 45
const DURATION_PRESETS = [30, 45, 60]

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

/** "2026-08-06" -> "6 Ağustos Perşembe" (takvimden seçilen günü aynen yansıtır). */
function formatWizardDate(dateISO) {
  if (!dateISO) return ''
  return new Date(dateISO).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' })
}

function ResourceBookCover({ book }) {
  if (book?.imageUrl) {
    return (
      <img loading="lazy" decoding="async"
        src={book.imageUrl}
        alt={`${book.name} görseli`}
        className="aspect-[3/4] w-full rounded-lg border border-panel-border object-cover"
      />
    )
  }

  return (
    <span className="flex aspect-[3/4] w-full items-center justify-center rounded-lg bg-panel-warm-soft text-panel-warm">
      <BookOpen size={28} aria-hidden="true" />
    </span>
  )
}

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

function hasResourceBookRates(book) {
  return book.completionRate !== undefined || book.successRate !== undefined
}

export default function AssignHomeworkModal({ defaultTaskDate, schoolSchedule, onSave, onClose }) {
  const [step, setStep] = useState('source')
  const [resourceBookId, setResourceBookId] = useState('')
  const [note, setNote] = useState('')
  const [totalQuestionCount, setTotalQuestionCount] = useState(0)
  const [totalPageCount, setTotalPageCount] = useState(0)
  const [taskTime, setTaskTime] = useState('')
  const [durationPreset, setDurationPreset] = useState(DEFAULT_TASK_DURATION_MINUTES)
  const [customDuration, setCustomDuration] = useState(30)
  const [resourceBooks, setResourceBooks] = useState(null)
  const [resourceBooksError, setResourceBooksError] = useState('')
  const [activeSubjectId, setActiveSubjectId] = useState(null)
  const [topics, setTopics] = useState(null)
  const [topicsError, setTopicsError] = useState('')
  const [selectedTestIds, setSelectedTestIds] = useState(new Set())
  const [collapsedTopicIds, setCollapsedTopicIds] = useState(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    let ignore = false

    getPanelHomeworkResourceBooks()
      .then((books) => {
        if (!ignore) setResourceBooks(books)
      })
      .catch((err) => {
        if (!ignore) setResourceBooksError(err.message)
      })

    return () => {
      ignore = true
    }
  }, [])

  const subjectGroups = useMemo(() => (resourceBooks ? groupResourceBooksBySubject(resourceBooks) : []), [resourceBooks])

  useEffect(() => {
    if (!resourceBooks) return
    if (activeSubjectId && subjectGroups.some((group) => group.id === activeSubjectId)) return
    setActiveSubjectId(subjectGroups[0]?.id || null)
  }, [activeSubjectId, resourceBooks, subjectGroups])

  useEffect(() => {
    if (!resourceBookId) return undefined

    let ignore = false
    setTopics(null)

    authRequest(`/api/panel/resource-book-topics?resourceBookId=${resourceBookId}`, { method: 'GET' })
      .then((data) => {
        if (ignore) return
        setTopics(data.topics)
        setCollapsedTopicIds(new Set(data.topics.map((topic) => topic.id)))
      })
      .catch((err) => {
        if (!ignore) setTopicsError(err.message)
      })

    return () => {
      ignore = true
    }
  }, [resourceBookId])

  const selectedBook = resourceBooks?.find((book) => book.id === resourceBookId) || null
  const activeSubject = subjectGroups.find((group) => group.id === activeSubjectId) || subjectGroups[0] || null
  const isReadingBook = selectedBook?.type === 'okuma_kitabi'

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

  const filteredTopics = useMemo(
    () => (topics ? filterTopicsBySearch(topics, searchQuery) : topics),
    [topics, searchQuery],
  )

  const handleSelectResourceBook = (book) => {
    setResourceBookId(book.id)
    setTopics(null)
    setSelectedTestIds(new Set())
    setCollapsedTopicIds(new Set())
    setTotalPageCount(0)
    setSearchQuery('')
    setStep('content')
  }

  const handleBackToSource = () => {
    setStep('source')
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

  const formattedDate = formatWizardDate(defaultTaskDate)

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (saving) return
    if (!resourceBookId) {
      setSaveError('Ödev için takip edilen bir kaynak seçmelisiniz.')
      return
    }

    const trimmedNote = note.trim()
    const trimmedTime = taskTime.trim()
    const selectedDuration = durationPreset === 'custom' ? Number(customDuration) || 0 : durationPreset
    const effectiveDuration = selectedDuration || DEFAULT_TASK_DURATION_MINUTES

    if (trimmedTime) {
      const effectiveEndTime = addMinutesToTime(trimmedTime, effectiveDuration)
      const schoolConflict = getSchoolScheduleConflict(schoolSchedule, defaultTaskDate, trimmedTime, effectiveEndTime)
      if (schoolConflict) {
        setSaveError(
          `Bu saatte öğrenci okulda (${schoolConflict.startTime}-${schoolConflict.endTime}${schoolConflict.lessonName ? ` · ${schoolConflict.lessonName}` : ''}). Bu saate ödev eklenemez.`,
        )
        return
      }
    }

    setSaving(true)
    setSaveError('')
    try {
      await onSave({
        subjectId: selectedBook.subjectId,
        resourceBookId,
        testIds: Array.from(selectedTestIds),
        title: (trimmedNote || selectedBook?.name || 'Ödev').slice(0, 200),
        description: trimmedNote || undefined,
        assignedDate: todayISODate(),
        dueDate: defaultTaskDate,
        totalQuestionCount: Number(totalQuestionCount) || 0,
        totalPageCount: isReadingBook ? Number(totalPageCount) || 0 : undefined,
        taskDate: defaultTaskDate,
        taskTime: trimmedTime || null,
        taskDurationMinutes: effectiveDuration,
      })
    } catch (err) {
      setSaveError(err.message || 'Bir hata oluştu, tekrar deneyin.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-center bg-black/40 sm:items-center sm:p-4">
      <form
        onSubmit={handleSubmit}
        className={cn(
          'flex h-full w-full flex-col overflow-hidden bg-panel-surface sm:h-auto sm:max-h-[90vh] sm:rounded-2xl sm:shadow-panel-2',
          step === 'source' ? 'sm:max-w-3xl' : 'sm:max-w-xl',
        )}
      >
        {/* Koyu başlık çubuğu */}
        <div className="flex shrink-0 items-center justify-between gap-3 bg-panel-blue px-4 py-3 text-white">
          <div className="flex min-w-0 items-center gap-1.5">
            {step === 'content' ? (
              <button
                type="button"
                onClick={handleBackToSource}
                aria-label="Kaynak listesine dön"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/80 hover:bg-white/10 hover:text-white"
              >
                <ArrowLeft size={18} aria-hidden="true" />
              </button>
            ) : null}
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold sm:text-base">
                {step === 'content' ? selectedBook?.name || 'Ödev Ekle' : 'Ödev Ekle'}
              </h2>
              <p className="truncate text-[11px] text-white/70">
                {step === 'source' ? '1. Adım · Kaynak seçin' : '2. Adım · İçerik ve detaylar'}
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Kapat"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/80 hover:bg-white/10 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        {/* Bağlam şeridi: tarih ve toplam soru her zaman görünür, tekrar aramaya gerek kalmaz */}
        {step === 'content' ? (
          <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-panel-border bg-panel-surface-soft px-4 py-2">
            {selectedBook?.publisherName ? <Badge tone="lilac">{selectedBook.publisherName}</Badge> : null}
            <span className="inline-flex items-center gap-1 text-xs font-medium capitalize text-panel-text-muted">
              <CalendarDays size={13} aria-hidden="true" />
              {formattedDate}
            </span>
            {!isReadingBook ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-panel-text-muted">
                <ListChecks size={13} aria-hidden="true" />
                {totalQuestionCount} soru
              </span>
            ) : null}
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {step === 'source' ? (
            <div className="flex flex-col gap-3">
              {resourceBooksError ? (
                <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-sm text-panel-warm">{resourceBooksError}</div>
              ) : resourceBooks === null ? (
                <LoadingState label="Kaynaklar yükleniyor..." />
              ) : resourceBooks.length === 0 ? (
                <p className="p-2 text-sm text-panel-text-muted">Takip edilen kaynak yok.</p>
              ) : (
                <div className="flex min-w-0 flex-col gap-3">
                  {subjectGroups.length > 1 ? (
                    <div className="flex gap-1 overflow-x-auto border-b border-panel-border">
                      {subjectGroups.map((subject) => (
                        <button
                          key={subject.id}
                          type="button"
                          onClick={() => setActiveSubjectId(subject.id)}
                          className={cn(
                            'shrink-0 whitespace-nowrap border-b-2 px-3 pb-2.5 text-sm font-semibold transition-colors',
                            activeSubject?.id === subject.id
                              ? 'border-panel-blue text-panel-blue'
                              : 'border-transparent text-panel-text-muted hover:text-panel-text',
                          )}
                        >
                          {subject.name}
                          <span className="ml-1.5 text-xs font-medium text-panel-text-muted">({subject.books.length})</span>
                        </button>
                      ))}
                    </div>
                  ) : null}

                  <div className="grid grid-cols-1 gap-3 min-[520px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
                    {(activeSubject?.books || []).map((book) => (
                      <button
                        key={book.id}
                        type="button"
                        onClick={() => handleSelectResourceBook(book)}
                        className="grid min-w-0 grid-cols-[4.5rem_minmax(0,1fr)] items-start gap-3 rounded-xl border border-panel-border p-2.5 text-left transition-colors hover:border-panel-warm hover:bg-panel-warm-soft/50 sm:flex sm:flex-col sm:items-stretch sm:gap-2"
                      >
                        <ResourceBookCover book={book} />
                        <div className="flex min-w-0 flex-col gap-1">
                          {book.publisherName ? (
                            <Badge tone="lilac" className="max-w-full overflow-hidden text-ellipsis whitespace-nowrap">
                              {book.publisherName}
                            </Badge>
                          ) : null}
                          <p className="line-clamp-2 text-sm font-semibold leading-snug text-panel-text">{book.name}</p>
                          {book.subjectName ? <p className="text-xs text-panel-text-muted">{book.subjectName}</p> : null}
                        </div>
                        {hasResourceBookRates(book) ? (
                          <ResourceBookRates
                            completionRate={book.completionRate}
                            successRate={book.successRate}
                            className="col-start-2 mt-0 grid-cols-2 sm:col-start-auto sm:grid-cols-1"
                          />
                        ) : null}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {!isReadingBook ? (
                <div className="flex flex-col gap-1.5">
                  <div className="relative">
                    <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-panel-text-muted" aria-hidden="true" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Konu, test veya sayfa ara..."
                      className="w-full rounded-xl border border-panel-border py-2 pl-9 pr-3 text-sm text-panel-text"
                    />
                  </div>
                  <div className="rounded-xl border border-panel-border p-1.5">
                    {topics === null ? (
                      <p className="p-2 text-xs text-panel-text-muted">İçerikler yükleniyor...</p>
                    ) : filteredTopics.length === 0 ? (
                      <p className="p-2 text-xs text-panel-text-muted">
                        {searchQuery.trim() ? 'Aramayla eşleşen içerik yok' : 'Bu kaynağa ait içerik yok'}
                      </p>
                    ) : (
                      filteredTopics.map((topic) => {
                        const isCollapsed = !searchQuery.trim() && collapsedTopicIds.has(topic.id)
                        return (
                          <div key={topic.id}>
                            <button
                              type="button"
                              onClick={() => toggleTopicCollapsed(topic.id)}
                              className="flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-sm hover:bg-panel-warm-soft/70"
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
                                  <label
                                    key={test.id}
                                    className={`flex items-center gap-2 rounded-lg px-2 py-0.5 text-xs ${
                                      test.completed
                                        ? 'cursor-not-allowed opacity-50'
                                        : test.assignedPending
                                          ? 'bg-panel-accent-soft hover:bg-panel-accent-soft/80'
                                          : 'hover:bg-panel-warm-soft/70'
                                    }`}
                                  >
                                    {test.completed ? (
                                      <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm bg-panel-warm text-white">
                                        <Check size={10} strokeWidth={3} />
                                      </span>
                                    ) : (
                                      <input
                                        type="checkbox"
                                        checked={selectedTestIds.has(test.id)}
                                        onChange={() => toggleTest(test.id)}
                                      />
                                    )}
                                    <span className="min-w-0 flex-1">
                                      <span className="block truncate text-sm font-medium text-panel-text">{test.name}</span>
                                      <span className="mt-0.5 block truncate text-xs text-panel-text-muted">
                                        s.{test.pageStart}-{test.pageEnd} · {test.questionCount} soru
                                      </span>
                                      {test.completed && test.correctCount != null ? (
                                        <span className="mt-0.5 block text-[10px] text-panel-text-muted">
                                          <span className="inline-flex items-center gap-0.5 align-middle text-panel-sage">
                                            <CheckCircle2 size={9} aria-hidden="true" />
                                            {test.correctCount}D
                                          </span>
                                          {' · '}
                                          <span className="inline-flex items-center gap-0.5 align-middle text-panel-red">
                                            <XCircle size={9} aria-hidden="true" />
                                            {test.wrongCount}Y
                                          </span>
                                          {` · ${test.blankCount}B`}
                                        </span>
                                      ) : null}
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
                <span className="text-xs font-medium text-panel-text-muted">Ödev Notu (isteğe bağlı)</span>
                <textarea
                  rows={2}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="örn. Sayfa 40-42 arası sorular"
                  className="rounded-xl border border-panel-border p-2.5 text-sm text-panel-text"
                />
              </label>

              {isReadingBook ? (
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-panel-text-muted">Sayfa Sayısı</span>
                  <input
                    type="number"
                    min="0"
                    value={totalPageCount}
                    onChange={(event) => setTotalPageCount(event.target.value)}
                    className="rounded-xl border border-panel-border p-2.5 text-sm text-panel-text"
                  />
                </label>
              ) : null}

              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-panel-text-muted">Başlangıç saati (isteğe bağlı)</span>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="time"
                    value={taskTime}
                    onChange={(event) => setTaskTime(event.target.value)}
                    className="w-32 shrink-0 rounded-xl border border-panel-border p-2.5 text-sm text-panel-text"
                  />
                  {taskTime ? (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {DURATION_PRESETS.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setDurationPreset(preset)}
                          className={cn(
                            'rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors',
                            durationPreset === preset
                              ? 'bg-panel-warm text-white'
                              : 'bg-panel-warm-soft text-panel-warm hover:bg-panel-warm hover:text-white',
                          )}
                        >
                          {preset} dk
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setDurationPreset('custom')}
                        className={cn(
                          'rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors',
                          durationPreset === 'custom'
                            ? 'bg-panel-warm text-white'
                            : 'bg-panel-warm-soft text-panel-warm hover:bg-panel-warm hover:text-white',
                        )}
                      >
                        Özel
                      </button>
                      {durationPreset === 'custom' ? (
                        <input
                          type="number"
                          min="5"
                          max="480"
                          value={customDuration}
                          onChange={(event) => setCustomDuration(event.target.value)}
                          placeholder="dk"
                          className="w-16 rounded-lg border border-panel-border p-1.5 text-xs text-panel-text"
                        />
                      ) : null}
                    </div>
                  ) : (
                    <span className="text-xs text-panel-text-muted">Boş bırakılırsa görev saatsiz eklenir, süre 45 dk olarak kaydedilir.</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {step === 'content' ? (
          <div className="shrink-0 border-t border-panel-border px-4 py-3">
            {saveError ? <p className="mb-2 text-xs text-panel-warm">{saveError}</p> : null}
            <button
              type="submit"
              disabled={saving}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-panel-warm px-4 py-3 text-sm font-semibold text-white hover:bg-panel-warm/90 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : null}
              {saving ? 'Kaydediliyor...' : 'Ödevi Kaydet'}
            </button>
          </div>
        ) : null}
      </form>
    </div>
  )
}
