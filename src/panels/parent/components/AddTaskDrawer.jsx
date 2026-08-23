import { useEffect, useMemo, useState } from 'react'
import { BookOpen, Check, ChevronDown, ChevronRight, Loader2, Search, Trash2, X } from 'lucide-react'
import { authRequest } from '../../../services/authClient'
import { TASK_TYPES } from '../../../data/taskTypes'
import { getSchoolScheduleConflict, hasOverlap } from '../../../services/weeklyPlanService'
import { todayISODate } from '../../../utils/time'
import Badge from '../../ui/Badge'
import { cn } from '../../ui/utils'
import { ResourceBookRates } from '../../shared/ResourceBookCard'
import { filterTopicsBySearch } from '../../shared/homework/topicSearch'

const QUESTION_BANK_HOMEWORK_TASK_TYPE = 'soru-bankasi-odevi'
const SCHOOL_HOMEWORK_TASK_TYPE = 'okul-odevi'
const ACTIVITY_HOMEWORK_TASK_TYPE = 'etkinlik-odevi'
const RESOURCE_TASK_TYPES = new Set([QUESTION_BANK_HOMEWORK_TASK_TYPE, SCHOOL_HOMEWORK_TASK_TYPE, ACTIVITY_HOMEWORK_TASK_TYPE])
const REQUIRED_RESOURCE_TASK_TYPES = new Set([QUESTION_BANK_HOMEWORK_TASK_TYPE, SCHOOL_HOMEWORK_TASK_TYPE])
const TASK_TYPE_OPTIONS = [
  { id: 'mola', label: TASK_TYPES.mola.label },
  { id: 'serbest-zaman', label: TASK_TYPES['serbest-zaman'].label },
  { id: 'spor', label: TASK_TYPES.spor.label },
  { id: 'yemek', label: TASK_TYPES.yemek.label },
  { id: QUESTION_BANK_HOMEWORK_TASK_TYPE, label: TASK_TYPES[QUESTION_BANK_HOMEWORK_TASK_TYPE].label },
  { id: SCHOOL_HOMEWORK_TASK_TYPE, label: TASK_TYPES[SCHOOL_HOMEWORK_TASK_TYPE].label },
  { id: ACTIVITY_HOMEWORK_TASK_TYPE, label: TASK_TYPES[ACTIVITY_HOMEWORK_TASK_TYPE].label },
]
const TASK_TYPE_OPTION_IDS = new Set(TASK_TYPE_OPTIONS.map((option) => option.id))
const DURATION_OPTIONS = [10, 20, 30, 45, 60, 90]

function computeDurationMinutes(startTime, endTime) {
  if (!startTime || !endTime) return 0
  const [startH, startM] = startTime.split(':').map(Number)
  const [endH, endM] = endTime.split(':').map(Number)
  return endH * 60 + endM - (startH * 60 + startM)
}

function addMinutesToTime(startTime, minutes) {
  if (!startTime || !minutes) return ''
  const [h, m] = startTime.split(':').map(Number)
  const total = (h * 60 + m + Number(minutes)) % (24 * 60)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

function normalizeTaskType(seed) {
  if (TASK_TYPE_OPTION_IDS.has(seed.taskType)) return seed.taskType
  if (seed.taskType === 'odev') {
    return seed.resourceType === 'soru_bankasi' ? QUESTION_BANK_HOMEWORK_TASK_TYPE : SCHOOL_HOMEWORK_TASK_TYPE
  }
  return QUESTION_BANK_HOMEWORK_TASK_TYPE
}

function getDefaultTitle(taskType) {
  return TASK_TYPES[taskType]?.label || 'Görev'
}

function buildQuestionBankNote(resourceBookName, topics, selectedTestIds) {
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
      if (selectedTestIds.has(test.id)) total += Number(test.questionCount) || 0
    })
  })
  return total
}

function sameSetValues(left, right) {
  if (left.size !== right.size) return false
  for (const value of left) {
    if (!right.has(value)) return false
  }
  return true
}

function groupBooksBySubject(books) {
  const groups = new Map()
  books.forEach((book) => {
    const key = book.subjectId || 'no-subject'
    if (!groups.has(key)) {
      groups.set(key, { id: key, name: book.subjectName || 'Derssiz Kaynaklar', books: [] })
    }
    groups.get(key).books.push(book)
  })
  return Array.from(groups.values())
}

function ResourceBookCover({ book }) {
  if (book?.imageUrl) {
    return (
      <img
        loading="lazy"
        decoding="async"
        src={book.imageUrl}
        alt={`${book.name} görseli`}
        className="aspect-[3/4] w-14 shrink-0 rounded-lg border border-panel-border object-cover"
      />
    )
  }

  return (
    <span className="flex aspect-[3/4] w-14 shrink-0 items-center justify-center rounded-lg bg-panel-warm-soft text-panel-warm">
      <BookOpen size={22} aria-hidden="true" />
    </span>
  )
}

function ResourceBookButton({ book, selected, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(book)}
      aria-pressed={selected}
      className={cn(
        'grid min-w-0 grid-cols-[3.5rem_minmax(0,1fr)] gap-3 rounded-xl border p-2.5 text-left transition-colors',
        selected
          ? 'border-panel-blue bg-panel-blue-soft/45 ring-2 ring-panel-blue-soft'
          : 'border-panel-border bg-white hover:border-panel-warm hover:bg-panel-warm-soft/35',
      )}
    >
      <ResourceBookCover book={book} />
      <span className="flex min-w-0 flex-col gap-1">
        <span className="flex min-w-0 flex-wrap items-center gap-1.5">
          {book.publisherName ? (
            <Badge tone="lilac" className="max-w-full overflow-hidden text-ellipsis whitespace-nowrap">
              {book.publisherName}
            </Badge>
          ) : null}
          {selected ? (
            <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-panel-blue text-white">
              <Check size={12} strokeWidth={3} aria-hidden="true" />
            </span>
          ) : null}
        </span>
        <span className="line-clamp-2 text-sm font-semibold leading-snug text-panel-text">{book.name}</span>
        {book.subjectName ? <span className="text-xs text-panel-text-muted">{book.subjectName}</span> : null}
        <ResourceBookRates
          completionRate={book.completionRate}
          successRate={book.successRate}
          className="mt-1 grid-cols-2"
        />
      </span>
    </button>
  )
}

export default function AddTaskDrawer({
  initialTask,
  initialTemplate,
  defaultDate,
  onSave,
  onDelete,
  onClose,
  getExistingTasksForDate,
  schoolSchedule,
}) {
  const seed = { ...initialTemplate?.task, ...initialTask }
  const seedTaskType = normalizeTaskType(seed)
  const seedStartTime = seed.startTime || '16:00'
  const seedEndTime = seed.endTime || (seed.durationMinutes ? addMinutesToTime(seedStartTime, seed.durationMinutes) : '16:45')
  const seedDurationMinutes = Number(seed.durationMinutes) || computeDurationMinutes(seedStartTime, seedEndTime) || 45

  const [form, setForm] = useState(() => ({
    title: seed.title || getDefaultTitle(seedTaskType),
    taskType: seedTaskType,
    date: seed.date || defaultDate || todayISODate(),
    startTime: seedStartTime,
    durationMinutes: seedDurationMinutes,
    description: seed.description || '',
  }))
  const [resourceBookId, setResourceBookId] = useState(seed.resourceBookId || '')
  const [subjectId, setSubjectId] = useState('')
  const [resourceBooks, setResourceBooks] = useState(null)
  const [resourceBooksError, setResourceBooksError] = useState('')
  const [topics, setTopics] = useState(null)
  const [topicsError, setTopicsError] = useState('')
  const [selectedTestIds, setSelectedTestIds] = useState(() => new Set(seed.selectedTestIds || []))
  const [collapsedTopicIds, setCollapsedTopicIds] = useState(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [durationMode, setDurationMode] = useState(() =>
    DURATION_OPTIONS.includes(seedDurationMinutes) ? seedDurationMinutes : 'custom',
  )
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [saving, setSaving] = useState(false)

  const durationMinutes = Number(form.durationMinutes) || 0
  const endTime = durationMinutes > 0 ? addMinutesToTime(form.startTime, durationMinutes) : ''
  const schoolConflict = endTime ? getSchoolScheduleConflict(schoolSchedule, form.date, form.startTime, endTime) : null
  const isQuestionBankHomework = form.taskType === QUESTION_BANK_HOMEWORK_TASK_TYPE
  const isSchoolHomework = form.taskType === SCHOOL_HOMEWORK_TASK_TYPE
  const isActivityHomework = form.taskType === ACTIVITY_HOMEWORK_TASK_TYPE
  const needsResource = RESOURCE_TASK_TYPES.has(form.taskType)
  const resourceRequired = REQUIRED_RESOURCE_TASK_TYPES.has(form.taskType)
  const modalMaxWidth = needsResource ? '48rem' : '38rem'

  const [conflict, setConflict] = useState(false)

  useEffect(() => {
    let ignore = false

    if (!getExistingTasksForDate || durationMinutes <= 0) {
      Promise.resolve().then(() => {
        if (!ignore) setConflict(false)
      })
      return () => {
        ignore = true
      }
    }

    Promise.resolve(getExistingTasksForDate(form.date))
      .then((tasksForDate) => {
        if (!ignore) setConflict(hasOverlap(tasksForDate, form.startTime, endTime, initialTask?.id))
      })
      .catch(() => {
        if (!ignore) setConflict(false)
      })

    return () => {
      ignore = true
    }
  }, [form.date, form.startTime, endTime, getExistingTasksForDate, initialTask?.id, durationMinutes])

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !saving && !deleting) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [deleting, onClose, saving])

  useEffect(() => {
    if (!needsResource || resourceBooks !== null || resourceBooksError) return undefined

    let ignore = false
    authRequest('/api/panel/resource-books', { method: 'GET' })
      .then((data) => {
        if (!ignore) setResourceBooks(data.resourceBooks || [])
      })
      .catch((err) => {
        if (!ignore) setResourceBooksError(err.message || 'Kaynaklar yüklenemedi.')
      })

    return () => {
      ignore = true
    }
  }, [needsResource, resourceBooks, resourceBooksError])

  useEffect(() => {
    if (!isQuestionBankHomework || !resourceBookId) return undefined

    let ignore = false

    authRequest(`/api/panel/resource-book-topics?resourceBookId=${resourceBookId}`, { method: 'GET' })
      .then((data) => {
        if (ignore) return
        setTopics(data.topics || [])
        setCollapsedTopicIds(new Set((data.topics || []).map((topic) => topic.id)))
      })
      .catch((err) => {
        if (!ignore) {
          setTopics([])
          setTopicsError(err.message || 'İçerikler yüklenemedi.')
        }
      })

    return () => {
      ignore = true
    }
  }, [isQuestionBankHomework, resourceBookId])

  // Etkinlik ödevi düzenlenirken kaydedilmiş kaynaktan dersi geri türet (ayrıca saklanmıyor).
  const effectiveSubjectId = useMemo(() => {
    if (subjectId || !isActivityHomework || !resourceBookId || !resourceBooks) return subjectId
    const book = resourceBooks.find((candidate) => candidate.id === resourceBookId)
    return book ? book.subjectId || 'no-subject' : subjectId
  }, [subjectId, isActivityHomework, resourceBookId, resourceBooks])

  const filteredResourceBooks = useMemo(() => {
    if (!resourceBooks) return []
    if (isQuestionBankHomework) return resourceBooks.filter((book) => book.type === 'soru_bankasi')
    if (isSchoolHomework) return resourceBooks.filter((book) => book.resourceSource === 'okul')
    if (isActivityHomework) {
      if (!effectiveSubjectId) return []
      return resourceBooks.filter((book) => (book.subjectId || 'no-subject') === effectiveSubjectId)
    }
    return []
  }, [isQuestionBankHomework, isSchoolHomework, isActivityHomework, resourceBooks, effectiveSubjectId])

  const resourceGroups = useMemo(() => groupBooksBySubject(filteredResourceBooks), [filteredResourceBooks])
  const subjectGroups = useMemo(() => groupBooksBySubject(resourceBooks || []), [resourceBooks])
  const isOriginalResourceSelection = Boolean(
    initialTask && needsResource && form.taskType === seedTaskType && resourceBookId && resourceBookId === seed.resourceBookId,
  )
  const loadedSelectedBook = resourceBooks?.find((book) => book.id === resourceBookId) || null
  const selectedBook =
    loadedSelectedBook ||
    (isOriginalResourceSelection
      ? {
          id: resourceBookId,
          name: seed.resourceBookName || seed.title || 'Seçili kaynak',
          subjectName: seed.subject || null,
        }
      : null)
  const hasValidResourceSelection = Boolean(
    resourceBookId && (filteredResourceBooks.some((book) => book.id === resourceBookId) || isOriginalResourceSelection),
  )
  const filteredTopics = useMemo(
    () => (topics ? filterTopicsBySearch(topics, searchQuery) : topics),
    [topics, searchQuery],
  )
  const totalQuestionCount = useMemo(
    () => sumSelectedQuestions(topics, selectedTestIds),
    [topics, selectedTestIds],
  )

  const handleChange = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }))
  }

  const resetResourceSelection = () => {
    setResourceBookId('')
    setTopics(null)
    setTopicsError('')
    setSelectedTestIds(new Set())
    setCollapsedTopicIds(new Set())
    setSearchQuery('')
  }

  const handleTaskTypeChange = (event) => {
    const nextTaskType = event.target.value
    setForm((current) => {
      const currentDefault = getDefaultTitle(current.taskType)
      const optionLabel = TASK_TYPE_OPTIONS.find((option) => option.label === current.title)
      const shouldReplaceTitle = !current.title.trim() || current.title === currentDefault || Boolean(optionLabel)
      return {
        ...current,
        taskType: nextTaskType,
        title: shouldReplaceTitle ? getDefaultTitle(nextTaskType) : current.title,
        description: nextTaskType === QUESTION_BANK_HOMEWORK_TASK_TYPE ? '' : current.description,
      }
    })
    setSubjectId('')
    resetResourceSelection()
  }

  const handleSubjectChange = (event) => {
    setSubjectId(event.target.value)
    resetResourceSelection()
  }

  const handleSelectResourceBook = (book) => {
    setResourceBookId(book.id)
    setTopics(null)
    setTopicsError('')
    setSelectedTestIds(new Set())
    setCollapsedTopicIds(new Set())
    setSearchQuery('')
    if (isQuestionBankHomework) setForm((current) => ({ ...current, description: '' }))
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
    const next = new Set(selectedTestIds)
    if (next.has(testId)) next.delete(testId)
    else next.add(testId)
    setSelectedTestIds(next)
    if (isQuestionBankHomework) {
      const note = buildQuestionBankNote(selectedBook?.name || '', topics, next)
      setForm((current) => ({ ...current, description: note }))
    }
  }

  const selectDuration = (minutes) => {
    setDurationMode(minutes)
    setForm((current) => ({ ...current, durationMinutes: minutes }))
  }

  const handleCustomDurationChange = (event) => {
    setDurationMode('custom')
    setForm((current) => ({ ...current, durationMinutes: event.target.value }))
  }

  const handleDelete = async () => {
    if (deleting) return
    setDeleting(true)
    setError('')
    try {
      await onDelete(initialTask)
    } catch (err) {
      setError(err.message || 'Görev silinirken bir hata oluştu, tekrar deneyin.')
      setDeleting(false)
    }
  }

  const selectedSubjectName = selectedBook?.subjectName || subjectGroups.find((group) => group.id === effectiveSubjectId)?.name || null

  const buildPayload = () => {
    const title =
      form.title.trim() ||
      (selectedBook?.subjectName && isQuestionBankHomework
        ? `${selectedBook.subjectName} Soru Bankası Ödevi`
        : selectedBook?.subjectName && isSchoolHomework
          ? `${selectedBook.subjectName} Okul Ödevi`
          : selectedSubjectName && isActivityHomework
            ? `${selectedSubjectName} Etkinlik Ödevi`
            : getDefaultTitle(form.taskType))
    const payload = {
      title,
      taskType: form.taskType,
      date: form.date,
      startTime: form.startTime,
      endTime,
      durationMinutes,
      description: form.description.trim() || null,
    }

    if (!needsResource) {
      return {
        ...payload,
        subject: null,
        topic: null,
        resourceBookId: null,
        selectedTestIds: [],
        targetQuestionCount: null,
        completedQuestionCount: null,
        targetPageCount: null,
        completedPageCount: null,
      }
    }

    if (isSchoolHomework) {
      return {
        ...payload,
        title,
        subject: selectedBook?.subjectName || null,
        resourceBookId,
        selectedTestIds: [],
        targetQuestionCount: null,
        completedQuestionCount: null,
        targetPageCount: null,
        completedPageCount: null,
      }
    }

    if (isActivityHomework) {
      return {
        ...payload,
        title,
        subject: selectedSubjectName,
        resourceBookId: resourceBookId || null,
        selectedTestIds: [],
        targetQuestionCount: null,
        completedQuestionCount: null,
        targetPageCount: null,
        completedPageCount: null,
      }
    }

    const nextSelectedTestIds = Array.from(selectedTestIds)
    const previousSelectedTestIds = new Set(initialTask?.selectedTestIds || [])
    const selectionChanged =
      initialTask?.resourceBookId !== resourceBookId || !sameSetValues(previousSelectedTestIds, selectedTestIds)

    const questionBankPayload = {
      ...payload,
      subject: selectedBook?.subjectName || null,
      resourceBookId,
      selectedTestIds: nextSelectedTestIds,
    }

    if (!selectionChanged) return questionBankPayload

    return {
      ...questionBankPayload,
      targetQuestionCount: Number(totalQuestionCount) || 0,
      completedQuestionCount: 0,
      answers: null,
      testResults: null,
      correctCount: null,
      wrongCount: null,
      blankCount: null,
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (saving || deleting) return

    if (!form.taskType) {
      setError('Görev türü seçin.')
      return
    }
    if (!form.date) {
      setError('Gün zorunludur.')
      return
    }
    if (!form.startTime) {
      setError('Başlangıç saati zorunludur.')
      return
    }
    if (durationMinutes <= 0) {
      setError('Süre seçin.')
      return
    }
    if (!needsResource && !form.title.trim()) {
      setError('Görev konusu boş bırakılamaz.')
      return
    }
    if (isActivityHomework && !effectiveSubjectId) {
      setError('Etkinlik ödevi için ders seçin.')
      return
    }
    if (resourceRequired && (!selectedBook || !hasValidResourceSelection)) {
      setError(isQuestionBankHomework ? 'Soru bankası ödevi için kaynak seçin.' : 'Okul ödevi için okul kaynağı seçin.')
      return
    }
    if (isQuestionBankHomework && selectedTestIds.size === 0) {
      setError('Soru bankası ödevi için en az bir içerik/test seçin.')
      return
    }
    if (schoolConflict) {
      setError(
        `Bu saatte öğrenci okulda (${schoolConflict.startTime}-${schoolConflict.endTime}${schoolConflict.lessonName ? ` · ${schoolConflict.lessonName}` : ''}). Bu saate görev eklenemez.`,
      )
      return
    }

    setError('')
    setSaving(true)
    try {
      await onSave(buildPayload())
    } catch (err) {
      setError(err.message || 'Görev kaydedilirken bir hata oluştu, tekrar deneyin.')
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={initialTask ? 'Görevi Düzenle' : 'Yeni Görev Ekle'}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving && !deleting) onClose()
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="flex max-h-[92vh] w-full min-w-0 flex-col overflow-hidden rounded-t-3xl bg-panel-surface shadow-2xl sm:max-h-[90vh] sm:rounded-2xl"
        style={{ maxWidth: modalMaxWidth }}
      >
        <div className="flex items-center justify-between border-b border-panel-border px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-semibold text-panel-text">
              {initialTask ? 'Görevi Düzenle' : 'Yeni Görev Ekle'}
            </h2>
            {endTime ? (
              <p className="mt-1 text-sm font-medium text-panel-text-muted">
                {form.startTime} - {endTime} · {durationMinutes} dk
              </p>
            ) : null}
          </div>
          <button
            type="button"
            aria-label="Kapat"
            onClick={onClose}
            disabled={saving || deleting}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-panel-text-muted transition-colors hover:bg-panel-surface-soft hover:text-panel-text disabled:cursor-not-allowed disabled:opacity-60"
          >
            <X size={20} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
          {error ? (
            <div className="mb-4 rounded-xl bg-panel-accent-soft px-4 py-3 text-sm text-panel-warm">{error}</div>
          ) : null}
          {schoolConflict ? (
            <div className="mb-4 rounded-xl bg-slate-100 px-4 py-3 text-sm font-medium text-slate-600">
              Bu saatte öğrenci okulda ({schoolConflict.startTime}-{schoolConflict.endTime}
              {schoolConflict.lessonName ? ` · ${schoolConflict.lessonName}` : ''}). Bu saate görev eklenemez.
            </div>
          ) : conflict ? (
            <div className="mb-4 rounded-xl bg-panel-accent-soft px-4 py-3 text-sm text-panel-warm">
              Bu saatte başka bir görev var. Yine de ekleyebilir veya saati değiştirebilirsin.
            </div>
          ) : null}

          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-panel-text-muted">Görev türü</span>
              <select
                value={form.taskType}
                onChange={handleTaskTypeChange}
                className="rounded-xl border border-panel-border bg-white p-3 text-base text-panel-text shadow-sm outline-none transition-colors focus:border-panel-blue focus:ring-2 focus:ring-panel-blue-soft"
              >
                {TASK_TYPE_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-panel-text-muted">Görev konusu</span>
              <input
                value={form.title}
                onChange={handleChange('title')}
                className="rounded-xl border border-panel-border bg-white p-3 text-base text-panel-text shadow-sm outline-none transition-colors focus:border-panel-blue focus:ring-2 focus:ring-panel-blue-soft"
              />
            </label>

            <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-panel-text-muted">Gün</span>
                <input
                  type="date"
                  value={form.date}
                  onChange={handleChange('date')}
                  className="rounded-xl border border-panel-border bg-white p-3 text-base text-panel-text shadow-sm outline-none transition-colors focus:border-panel-blue focus:ring-2 focus:ring-panel-blue-soft"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-panel-text-muted">Başlangıç saati</span>
                <input
                  type="time"
                  value={form.startTime}
                  onChange={handleChange('startTime')}
                  className="rounded-xl border border-panel-border bg-white p-3 text-base text-panel-text shadow-sm outline-none transition-colors focus:border-panel-blue focus:ring-2 focus:ring-panel-blue-soft"
                />
              </label>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-panel-text-muted">Süre</span>
              <div className="grid grid-cols-2 gap-2 min-[420px]:grid-cols-4">
                {DURATION_OPTIONS.map((minutes) => {
                  const selected = durationMode === minutes
                  return (
                    <button
                      key={minutes}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => selectDuration(minutes)}
                      className={`h-11 rounded-xl border px-3 text-sm font-semibold transition-colors ${
                        selected
                          ? 'border-panel-blue bg-panel-blue-soft text-panel-blue'
                          : 'border-panel-border bg-white text-panel-text-muted hover:bg-panel-surface-soft'
                      }`}
                    >
                      {minutes} dk
                    </button>
                  )
                })}
                <button
                  type="button"
                  aria-pressed={durationMode === 'custom'}
                  onClick={() => setDurationMode('custom')}
                  className={`h-11 rounded-xl border px-3 text-sm font-semibold transition-colors ${
                    durationMode === 'custom'
                      ? 'border-panel-blue bg-panel-blue-soft text-panel-blue'
                      : 'border-panel-border bg-white text-panel-text-muted hover:bg-panel-surface-soft'
                  }`}
                >
                  Özel
                </button>
              </div>

              {durationMode === 'custom' ? (
                <label className="mt-1 flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-panel-text-muted">Özel süre (dk)</span>
                  <input
                    type="number"
                    min="1"
                    max="360"
                    value={form.durationMinutes}
                    onChange={handleCustomDurationChange}
                    className="rounded-xl border border-panel-border bg-white p-3 text-base text-panel-text shadow-sm outline-none transition-colors focus:border-panel-blue focus:ring-2 focus:ring-panel-blue-soft"
                  />
                </label>
              ) : null}
            </div>

            {needsResource ? (
              <div className="flex flex-col gap-2 rounded-2xl border border-panel-border bg-panel-surface-soft/60 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-panel-text">
                    {isQuestionBankHomework
                      ? 'Soru bankası kaynağı'
                      : isSchoolHomework
                        ? 'Okul dersleri kaynakları'
                        : 'Etkinlik kaynağı (isteğe bağlı)'}
                  </span>
                  {selectedBook ? (
                    <span className="flex items-center gap-1.5">
                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-panel-text-muted">
                        {selectedBook.subjectName || 'Kaynak seçildi'}
                      </span>
                      {isActivityHomework ? (
                        <button
                          type="button"
                          onClick={resetResourceSelection}
                          className="text-xs font-semibold text-panel-blue hover:underline"
                        >
                          Seçimi kaldır
                        </button>
                      ) : null}
                    </span>
                  ) : null}
                </div>

                {isActivityHomework ? (
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-panel-text-muted">Ders</span>
                    <select
                      value={effectiveSubjectId}
                      onChange={handleSubjectChange}
                      className="rounded-xl border border-panel-border bg-white p-2.5 text-sm text-panel-text shadow-sm outline-none transition-colors focus:border-panel-blue focus:ring-2 focus:ring-panel-blue-soft"
                    >
                      <option value="">Ders seçin</option>
                      {subjectGroups.map((group) => (
                        <option key={group.id} value={group.id}>
                          {group.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}

                {resourceBooksError ? (
                  <p className="rounded-xl bg-panel-accent-soft px-3 py-2 text-sm text-panel-warm">{resourceBooksError}</p>
                ) : resourceBooks === null ? (
                  <p className="rounded-xl bg-white px-3 py-3 text-sm text-panel-text-muted">Kaynaklar yükleniyor...</p>
                ) : isActivityHomework && !effectiveSubjectId ? (
                  <p className="rounded-xl bg-white px-3 py-3 text-sm text-panel-text-muted">Kaynakları görmek için ders seçin.</p>
                ) : filteredResourceBooks.length === 0 ? (
                  <p className="rounded-xl bg-white px-3 py-3 text-sm text-panel-text-muted">
                    {isQuestionBankHomework
                      ? 'Öğrenciye atanmış soru bankası kaynağı yok.'
                      : isSchoolHomework
                        ? 'Öğrenciye atanmış okul kaynağı yok.'
                        : 'Bu derse ait kaynak yok.'}
                  </p>
                ) : isSchoolHomework ? (
                  <div className="max-h-80 overflow-y-auto pr-1">
                    <div className="flex flex-col gap-3">
                      {resourceGroups.map((group) => (
                        <div key={group.id} className="flex flex-col gap-2">
                          <p className="text-xs font-bold uppercase tracking-wide text-panel-text-muted">{group.name}</p>
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            {group.books.map((book) => (
                              <ResourceBookButton
                                key={book.id}
                                book={book}
                                selected={book.id === resourceBookId}
                                onSelect={handleSelectResourceBook}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="grid max-h-80 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                    {filteredResourceBooks.map((book) => (
                      <ResourceBookButton
                        key={book.id}
                        book={book}
                        selected={book.id === resourceBookId}
                        onSelect={handleSelectResourceBook}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            {isQuestionBankHomework && resourceBookId ? (
              <div className="flex flex-col gap-2 rounded-2xl border border-panel-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-panel-text">İçerik seçimi</span>
                  <span className="rounded-full bg-panel-blue-soft px-2.5 py-1 text-xs font-bold text-panel-blue">
                    {totalQuestionCount} soru
                  </span>
                </div>
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
                <div className="max-h-72 overflow-y-auto rounded-xl border border-panel-border p-1.5">
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
                          {topic.tests.length > 0 && !isCollapsed ? (
                            <div className="ml-6 flex flex-col">
                              {topic.tests.map((test) => (
                                <label
                                  key={test.id}
                                  className={cn(
                                    'flex items-center gap-2 rounded-lg px-2 py-0.5 text-xs',
                                    test.completed
                                      ? 'cursor-not-allowed opacity-50'
                                      : test.assignedPending
                                        ? 'bg-panel-accent-soft hover:bg-panel-accent-soft/80'
                                        : 'hover:bg-panel-warm-soft/70',
                                  )}
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
              <span className="text-sm font-medium text-panel-text-muted">Görev açıklaması</span>
              <textarea
                rows={3}
                value={form.description}
                onChange={handleChange('description')}
                className="resize-none rounded-xl border border-panel-border bg-white p-3 text-base text-panel-text shadow-sm outline-none transition-colors focus:border-panel-blue focus:ring-2 focus:ring-panel-blue-soft"
              />
            </label>
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-panel-border px-4 py-3 sm:flex-row sm:gap-3 sm:px-6 sm:py-4">
          {initialTask && onDelete ? (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting || saving}
              className="flex h-12 items-center justify-center gap-2 rounded-xl border border-panel-warm/40 px-4 text-sm font-semibold text-panel-warm hover:bg-panel-warm/10 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} aria-hidden="true" />}
              Görevi Sil
            </button>
          ) : null}
          <button
            type="submit"
            disabled={deleting || saving || Boolean(schoolConflict)}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-panel-blue px-4 py-3 text-base font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
          >
            {saving ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : null}
            {initialTask ? 'Değişiklikleri Kaydet' : 'Görevi Ekle'}
          </button>
        </div>
      </form>
    </div>
  )
}
