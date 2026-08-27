import { useEffect, useMemo, useRef, useState } from 'react'
import { BookOpen, Check, ChevronDown, ChevronRight, Loader2, Search, Trash2, X } from 'lucide-react'
import { authRequest } from '../../../services/authClient'
import { TASK_TYPES } from '../../../data/taskTypes'
import { getPrivateLessonTeachers, getSchoolScheduleConflict, hasOverlap } from '../../../services/weeklyPlanService'
import { todayISODate } from '../../../utils/time'
import Badge from '../../ui/Badge'
import { cn } from '../../ui/utils'
import { ResourceBookRates } from '../../shared/ResourceBookCard'
import { filterTopicsBySearch } from '../../shared/homework/topicSearch'

const QUESTION_BANK_HOMEWORK_TASK_TYPE = 'soru-bankasi-odevi'
const SCHOOL_HOMEWORK_TASK_TYPE = 'okul-odevi'
const PRIVATE_LESSON_TASK_TYPE = 'ozel-ders'
// Kütüphane "kaynak kitabı" (ResourceBooks) seçimi gerektiren türler. Okul Ödevi artık
// kütüphane kitabı değil, okul+sınıf+ders bazlı okul kaynağı (SchoolClassResources) kullanır.
const RESOURCE_TASK_TYPES = new Set([QUESTION_BANK_HOMEWORK_TASK_TYPE])
const REQUIRED_RESOURCE_TASK_TYPES = new Set([QUESTION_BANK_HOMEWORK_TASK_TYPE])
const TITLE_OPTIONAL_TASK_TYPES = new Set(['mola', 'serbest-zaman', 'spor', 'yemek'])
const STUDY_TASK_TYPES = new Set([QUESTION_BANK_HOMEWORK_TASK_TYPE, SCHOOL_HOMEWORK_TASK_TYPE, PRIVATE_LESSON_TASK_TYPE])
const TASK_TYPE_OPTIONS = [
  { id: 'mola', label: TASK_TYPES.mola.label },
  { id: 'serbest-zaman', label: TASK_TYPES['serbest-zaman'].label },
  { id: 'spor', label: TASK_TYPES.spor.label },
  { id: 'yemek', label: TASK_TYPES.yemek.label },
  { id: QUESTION_BANK_HOMEWORK_TASK_TYPE, label: TASK_TYPES[QUESTION_BANK_HOMEWORK_TASK_TYPE].label },
  { id: SCHOOL_HOMEWORK_TASK_TYPE, label: TASK_TYPES[SCHOOL_HOMEWORK_TASK_TYPE].label },
  { id: PRIVATE_LESSON_TASK_TYPE, label: TASK_TYPES[PRIVATE_LESSON_TASK_TYPE].label },
].sort((a, b) => a.label.localeCompare(b.label, 'tr'))
const TASK_TYPE_OPTION_IDS = new Set(TASK_TYPE_OPTIONS.map((option) => option.id))
const STUDY_TASK_TYPE_OPTIONS = TASK_TYPE_OPTIONS.filter((option) => STUDY_TASK_TYPES.has(option.id))
const OTHER_TASK_TYPE_OPTIONS = TASK_TYPE_OPTIONS.filter((option) => !STUDY_TASK_TYPES.has(option.id))
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

function normalizeTaskType(seed, hasSeed) {
  if (TASK_TYPE_OPTION_IDS.has(seed.taskType)) return seed.taskType
  if (seed.taskType === 'odev') {
    return seed.resourceType === 'soru_bankasi' ? QUESTION_BANK_HOMEWORK_TASK_TYPE : SCHOOL_HOMEWORK_TASK_TYPE
  }
  return hasSeed ? QUESTION_BANK_HOMEWORK_TASK_TYPE : ''
}

function getDefaultTitle(taskType) {
  return TASK_TYPES[taskType]?.label || 'Görev'
}

function buildAutoTitle(taskType, subjectName, extraName) {
  if (!taskType) return ''
  return [getDefaultTitle(taskType), subjectName, extraName].filter(Boolean).join(' - ')
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

function ResourceBookDropdown({ books, selectedBook, onSelect, placeholder }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const handlePointerDown = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 rounded-xl border border-panel-border bg-white p-2.5 text-left shadow-sm outline-none transition-colors hover:border-panel-warm focus:border-panel-blue focus:ring-2 focus:ring-panel-blue-soft"
      >
        {selectedBook ? (
          <>
            <ResourceBookCover book={selectedBook} />
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              {selectedBook.publisherName ? (
                <Badge tone="lilac" className="max-w-full self-start overflow-hidden text-ellipsis whitespace-nowrap">
                  {selectedBook.publisherName}
                </Badge>
              ) : null}
              <span className="line-clamp-1 text-sm font-semibold text-panel-text">{selectedBook.name}</span>
              {selectedBook.subjectName ? (
                <span className="text-xs text-panel-text-muted">{selectedBook.subjectName}</span>
              ) : null}
            </span>
          </>
        ) : (
          <span className="flex-1 py-1.5 text-sm text-panel-text-muted">{placeholder}</span>
        )}
        <ChevronDown
          size={16}
          className={cn('shrink-0 self-start text-panel-text-muted transition-transform', open && 'rotate-180')}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div className="absolute z-10 mt-2 max-h-80 w-full overflow-y-auto rounded-xl border border-panel-border bg-white p-2 shadow-lg">
          {books.length === 0 ? (
            <p className="p-3 text-sm text-panel-text-muted">Bu derse ait kaynak yok.</p>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {books.map((book) => (
                <ResourceBookButton
                  key={book.id}
                  book={book}
                  selected={selectedBook?.id === book.id}
                  onSelect={(picked) => {
                    onSelect(picked)
                    setOpen(false)
                  }}
                />
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}

function SchoolResourceAvatar({ resource, size = 'md' }) {
  const dimClass = size === 'sm' ? 'h-9 w-9' : 'h-11 w-11'
  if (resource?.imageUrl) {
    return (
      <img
        loading="lazy"
        decoding="async"
        src={resource.imageUrl}
        alt={`${resource.name} görseli`}
        className={cn(dimClass, 'shrink-0 rounded-full border border-panel-border object-cover')}
      />
    )
  }
  return (
    <span className={cn(dimClass, 'flex shrink-0 items-center justify-center rounded-full bg-panel-warm-soft text-panel-warm')}>
      <BookOpen size={size === 'sm' ? 16 : 18} aria-hidden="true" />
    </span>
  )
}

// Okul Ödevi için okul+sınıf+ders bazlı okul kaynağı seçimi (bkz. api/src/schoolResources.js).
// ResourceBookDropdown'un sadeleştirilmiş hâli: yuvarlak profil resmi + kaynak adı.
function SchoolResourceDropdown({ resources, selectedResource, onSelect, placeholder }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const handlePointerDown = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 rounded-xl border border-panel-border bg-white p-2.5 text-left shadow-sm outline-none transition-colors hover:border-panel-warm focus:border-panel-blue focus:ring-2 focus:ring-panel-blue-soft"
      >
        {selectedResource ? (
          <>
            <SchoolResourceAvatar resource={selectedResource} />
            <span className="line-clamp-1 flex-1 text-sm font-semibold text-panel-text">{selectedResource.name}</span>
          </>
        ) : (
          <span className="flex-1 py-1.5 text-sm text-panel-text-muted">{placeholder}</span>
        )}
        <ChevronDown
          size={16}
          className={cn('shrink-0 text-panel-text-muted transition-transform', open && 'rotate-180')}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div className="absolute z-10 mt-2 max-h-72 w-full overflow-y-auto rounded-xl border border-panel-border bg-white p-2 shadow-lg">
          {resources.length === 0 ? (
            <p className="p-3 text-sm text-panel-text-muted">Bu derse tanımlı okul kaynağı yok.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {resources.map((resource) => (
                <button
                  key={resource.id}
                  type="button"
                  onClick={() => {
                    onSelect(resource)
                    setOpen(false)
                  }}
                  aria-pressed={selectedResource?.id === resource.id}
                  className={cn(
                    'flex items-center gap-3 rounded-lg border p-2 text-left transition-colors',
                    selectedResource?.id === resource.id
                      ? 'border-panel-blue bg-panel-blue-soft/45'
                      : 'border-transparent hover:bg-panel-warm-soft/50',
                  )}
                >
                  <SchoolResourceAvatar resource={resource} size="sm" />
                  <span className="line-clamp-1 flex-1 text-sm font-medium text-panel-text">{resource.name}</span>
                  {selectedResource?.id === resource.id ? (
                    <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-panel-blue text-white">
                      <Check size={12} strokeWidth={3} aria-hidden="true" />
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
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
  schoolHolidays,
}) {
  const seed = { ...initialTemplate?.task, ...initialTask }
  const seedTaskType = normalizeTaskType(seed, Boolean(initialTask || initialTemplate))
  const seedStartTime = seed.startTime || ''
  const seedEndTime =
    seed.endTime || (seedStartTime && seed.durationMinutes ? addMinutesToTime(seedStartTime, seed.durationMinutes) : '')
  const seedDurationMinutes =
    Number(seed.durationMinutes) || (seedStartTime ? computeDurationMinutes(seedStartTime, seedEndTime) : 0) || 0
  const seedTitle = seed.title || (seedTaskType ? getDefaultTitle(seedTaskType) : '')

  const [form, setForm] = useState(() => ({
    title: seedTitle,
    taskType: seedTaskType,
    date: seed.date || defaultDate || todayISODate(),
    startTime: seedStartTime,
    durationMinutes: seedDurationMinutes,
    description: seed.description || '',
  }))
  const autoTitleRef = useRef(seedTitle)
  const [resourceBookId, setResourceBookId] = useState(seed.resourceBookId || '')
  const [schoolResourceId, setSchoolResourceId] = useState(seed.schoolResourceId || '')
  const [schoolSubjectId, setSchoolSubjectId] = useState('')
  const [schoolResourceGroups, setSchoolResourceGroups] = useState(null)
  const [schoolResourceGroupsError, setSchoolResourceGroupsError] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [lessonSubjectId, setLessonSubjectId] = useState('')
  const [studentTeacherId, setStudentTeacherId] = useState(seed.studentTeacherId || '')
  const [privateTeachers, setPrivateTeachers] = useState(null)
  const [privateTeachersError, setPrivateTeachersError] = useState('')
  const [resourceBooks, setResourceBooks] = useState(null)
  const [resourceBooksError, setResourceBooksError] = useState('')
  const [topics, setTopics] = useState(null)
  const [topicsError, setTopicsError] = useState('')
  const [selectedTestIds, setSelectedTestIds] = useState(() => new Set(seed.selectedTestIds || []))
  const [collapsedTopicIds, setCollapsedTopicIds] = useState(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [durationMode, setDurationMode] = useState(() =>
    DURATION_OPTIONS.includes(seedDurationMinutes) ? seedDurationMinutes : seedDurationMinutes > 0 ? 'custom' : '',
  )
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [saving, setSaving] = useState(false)

  const durationMinutes = Number(form.durationMinutes) || 0
  const endTime = durationMinutes > 0 ? addMinutesToTime(form.startTime, durationMinutes) : ''
  const schoolConflict = endTime
    ? getSchoolScheduleConflict(schoolSchedule, form.date, form.startTime, endTime, schoolHolidays)
    : null
  const isQuestionBankHomework = form.taskType === QUESTION_BANK_HOMEWORK_TASK_TYPE
  const isSchoolHomework = form.taskType === SCHOOL_HOMEWORK_TASK_TYPE
  const isPrivateLesson = form.taskType === PRIVATE_LESSON_TASK_TYPE
  const needsResource = RESOURCE_TASK_TYPES.has(form.taskType)
  const resourceRequired = REQUIRED_RESOURCE_TASK_TYPES.has(form.taskType)
  const needsTitleInput = !TITLE_OPTIONAL_TASK_TYPES.has(form.taskType)
  const modalMaxWidth = '48rem'

  const [conflict, setConflict] = useState(false)

  useEffect(() => {
    let ignore = false

    if (!getExistingTasksForDate || durationMinutes <= 0 || !form.startTime) {
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
    if (!isSchoolHomework || schoolResourceGroups !== null || schoolResourceGroupsError) return undefined

    let ignore = false
    authRequest('/api/panel/school-resources', { method: 'GET' })
      .then((data) => {
        if (!ignore) setSchoolResourceGroups(data.groups || [])
      })
      .catch((err) => {
        if (!ignore) setSchoolResourceGroupsError(err.message || 'Okul kaynakları yüklenemedi.')
      })

    return () => {
      ignore = true
    }
  }, [isSchoolHomework, schoolResourceGroups, schoolResourceGroupsError])

  useEffect(() => {
    if (!isPrivateLesson || privateTeachers !== null || privateTeachersError) return undefined

    let ignore = false
    getPrivateLessonTeachers()
      .then((teachers) => {
        if (!ignore) setPrivateTeachers(teachers)
      })
      .catch((err) => {
        if (!ignore) setPrivateTeachersError(err.message || 'Öğretmenler yüklenemedi.')
      })

    return () => {
      ignore = true
    }
  }, [isPrivateLesson, privateTeachers, privateTeachersError])

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

  // Kaynak seçili görev düzenlenirken kaydedilmiş kaynaktan dersi geri türet (ayrıca saklanmıyor).
  const effectiveSubjectId = useMemo(() => {
    if (subjectId || !needsResource || !resourceBookId || !resourceBooks) return subjectId
    const book = resourceBooks.find((candidate) => candidate.id === resourceBookId)
    return book ? book.subjectId || 'no-subject' : subjectId
  }, [subjectId, needsResource, resourceBookId, resourceBooks])

  const questionBankResourceBooks = useMemo(
    () => (resourceBooks || []).filter((book) => book.type === 'soru_bankasi'),
    [resourceBooks],
  )
  const questionBankSubjectGroups = useMemo(() => groupBooksBySubject(questionBankResourceBooks), [questionBankResourceBooks])
  const activeSubjectGroups = isQuestionBankHomework ? questionBankSubjectGroups : []

  const filteredResourceBooks = useMemo(() => {
    if (!resourceBooks || !effectiveSubjectId || !isQuestionBankHomework) return []
    return questionBankResourceBooks.filter((book) => (book.subjectId || 'no-subject') === effectiveSubjectId)
  }, [resourceBooks, effectiveSubjectId, isQuestionBankHomework, questionBankResourceBooks])

  // --- Okul Ödevi: okul+sınıf+ders bazlı okul kaynağı seçimi ---
  // Görev düzenlenirken kayıtlı kaynaktan dersi geri türet.
  const effectiveSchoolSubjectId =
    schoolSubjectId ||
    (schoolResourceId && schoolResourceGroups
      ? schoolResourceGroups.find((group) => group.resources.some((r) => r.id === schoolResourceId))?.subjectId || ''
      : '')
  const selectedSchoolSubjectName =
    schoolResourceGroups?.find((group) => group.subjectId === effectiveSchoolSubjectId)?.subjectName || null
  const schoolResourcesForSubject =
    schoolResourceGroups?.find((group) => group.subjectId === effectiveSchoolSubjectId)?.resources || []
  const selectedSchoolResource =
    schoolResourceGroups?.flatMap((group) => group.resources).find((r) => r.id === schoolResourceId) ||
    (schoolResourceId && seed.schoolResourceId === schoolResourceId
      ? {
          id: schoolResourceId,
          name: seed.schoolResourceName || seed.title || 'Seçili kaynak',
          imageUrl: seed.schoolResourceImageUrl || null,
        }
      : null)

  const lessonSubjectGroups = useMemo(() => {
    const groups = new Map()
    ;(privateTeachers || []).forEach((teacher) => {
      const key = teacher.subjectId || 'no-subject'
      if (!groups.has(key)) groups.set(key, { id: key, name: teacher.subjectName || 'Derssiz', teachers: [] })
      groups.get(key).teachers.push(teacher)
    })
    return Array.from(groups.values())
  }, [privateTeachers])

  // Özel ders görevi düzenlenirken kaydedilmiş öğretmenden dersi geri türet (ayrıca saklanmıyor).
  const effectiveLessonSubjectId = useMemo(() => {
    if (lessonSubjectId || !isPrivateLesson || !studentTeacherId || !privateTeachers) return lessonSubjectId
    const teacher = privateTeachers.find((candidate) => candidate.id === studentTeacherId)
    return teacher ? teacher.subjectId || 'no-subject' : lessonSubjectId
  }, [lessonSubjectId, isPrivateLesson, studentTeacherId, privateTeachers])

  const lessonTeachersForSubject = useMemo(() => {
    if (!privateTeachers || !effectiveLessonSubjectId) return []
    return privateTeachers.filter((teacher) => (teacher.subjectId || 'no-subject') === effectiveLessonSubjectId)
  }, [privateTeachers, effectiveLessonSubjectId])

  const selectedPrivateTeacher = privateTeachers?.find((teacher) => teacher.id === studentTeacherId) || null

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
    setSchoolSubjectId('')
    setSchoolResourceId('')
  }

  const applyAutoTitle = (nextAutoTitle, extra) => {
    setForm((current) => {
      const shouldReplaceTitle = !current.title.trim() || current.title === autoTitleRef.current
      return shouldReplaceTitle ? { ...current, title: nextAutoTitle, ...extra } : { ...current, ...extra }
    })
    autoTitleRef.current = nextAutoTitle
  }

  const handleTaskTypeChange = (event) => {
    const nextTaskType = event.target.value
    applyAutoTitle(buildAutoTitle(nextTaskType, null, null), {
      taskType: nextTaskType,
      description: nextTaskType === QUESTION_BANK_HOMEWORK_TASK_TYPE ? '' : form.description,
    })
    setSubjectId('')
    setLessonSubjectId('')
    setStudentTeacherId('')
    resetResourceSelection()
  }

  const handleSubjectChange = (event) => {
    const nextSubjectId = event.target.value
    const subjectName = activeSubjectGroups.find((group) => group.id === nextSubjectId)?.name || null
    applyAutoTitle(buildAutoTitle(form.taskType, subjectName, null))
    setSubjectId(nextSubjectId)
    resetResourceSelection()
  }

  const handleSchoolSubjectChange = (event) => {
    const nextSubjectId = event.target.value
    const subjectName = schoolResourceGroups?.find((group) => group.subjectId === nextSubjectId)?.subjectName || null
    applyAutoTitle(buildAutoTitle(form.taskType, subjectName, null))
    setSchoolSubjectId(nextSubjectId)
    setSchoolResourceId('')
  }

  const handleSelectSchoolResource = (resource) => {
    applyAutoTitle(buildAutoTitle(form.taskType, selectedSchoolSubjectName, resource.name || null))
    setSchoolResourceId(resource.id)
  }

  const handleClearSchoolResource = () => {
    applyAutoTitle(buildAutoTitle(form.taskType, selectedSchoolSubjectName, null))
    setSchoolResourceId('')
  }

  const handleLessonSubjectChange = (event) => {
    const nextLessonSubjectId = event.target.value
    const subjectName = lessonSubjectGroups.find((group) => group.id === nextLessonSubjectId)?.name || null
    applyAutoTitle(buildAutoTitle(form.taskType, subjectName, null))
    setLessonSubjectId(nextLessonSubjectId)
    setStudentTeacherId('')
  }

  const handleTeacherChange = (event) => {
    const nextTeacherId = event.target.value
    const teacher = lessonTeachersForSubject.find((candidate) => candidate.id === nextTeacherId) || null
    applyAutoTitle(buildAutoTitle(form.taskType, selectedLessonSubjectName, teacher?.fullName || null))
    setStudentTeacherId(nextTeacherId)
  }

  const handleSelectResourceBook = (book) => {
    applyAutoTitle(buildAutoTitle(form.taskType, book.subjectName || null, book.name || null), {
      description: isQuestionBankHomework ? '' : form.description,
    })
    setResourceBookId(book.id)
    setTopics(null)
    setTopicsError('')
    setSelectedTestIds(new Set())
    setCollapsedTopicIds(new Set())
    setSearchQuery('')
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

  const handleDurationSelectChange = (event) => {
    const value = event.target.value
    if (value === '') {
      setDurationMode('')
      setForm((current) => ({ ...current, durationMinutes: 0 }))
      return
    }
    if (value === 'custom') {
      setDurationMode('custom')
      return
    }
    const minutes = Number(value)
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

  const selectedSubjectName =
    selectedBook?.subjectName || activeSubjectGroups.find((group) => group.id === effectiveSubjectId)?.name || null
  const selectedLessonSubjectName =
    selectedPrivateTeacher?.subjectName || lessonSubjectGroups.find((group) => group.id === effectiveLessonSubjectId)?.name || null

  const hasRequiredSubSelection = isPrivateLesson
    ? Boolean(effectiveLessonSubjectId)
    : isSchoolHomework
      ? true
      : needsResource
        ? Boolean(effectiveSubjectId)
        : true
  const showTitleInput = needsTitleInput && Boolean(form.taskType) && hasRequiredSubSelection

  const buildPayload = () => {
    const title =
      (needsTitleInput && form.title.trim()) ||
      (selectedBook?.subjectName && isQuestionBankHomework
        ? `${selectedBook.subjectName} Soru Bankası Ödevi`
        : selectedSchoolSubjectName && isSchoolHomework
          ? `${selectedSchoolSubjectName} Okul Ödevi`
          : selectedLessonSubjectName && isPrivateLesson
            ? `${selectedLessonSubjectName} Özel Ders`
            : getDefaultTitle(form.taskType))
    const payload = {
      title,
      taskType: form.taskType,
      date: form.date,
      startTime: form.startTime || null,
      endTime: endTime || null,
      durationMinutes,
      description: form.description.trim() || null,
    }

    if (isPrivateLesson) {
      return {
        ...payload,
        subject: selectedLessonSubjectName,
        topic: null,
        resourceBookId: null,
        schoolResourceId: null,
        studentTeacherId: studentTeacherId || null,
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
        subject: selectedSchoolSubjectName,
        resourceBookId: null,
        schoolResourceId: schoolResourceId || null,
        studentTeacherId: null,
        selectedTestIds: [],
        targetQuestionCount: null,
        completedQuestionCount: null,
        targetPageCount: null,
        completedPageCount: null,
      }
    }

    if (!needsResource) {
      return {
        ...payload,
        subject: null,
        topic: null,
        resourceBookId: null,
        schoolResourceId: null,
        studentTeacherId: null,
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
      subject: selectedSubjectName,
      resourceBookId,
      schoolResourceId: null,
      studentTeacherId: null,
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
    if (!needsResource && !form.title.trim()) {
      setError('Görev konusu boş bırakılamaz.')
      return
    }
    if (isQuestionBankHomework && !effectiveSubjectId) {
      setError('Soru bankası ödevi için ders seçin.')
      return
    }
    if (isSchoolHomework && !form.title.trim()) {
      setError('Görev konusu boş bırakılamaz.')
      return
    }
    if (isPrivateLesson && !effectiveLessonSubjectId) {
      setError('Özel ders için ders seçin.')
      return
    }
    if (isPrivateLesson && !studentTeacherId) {
      setError('Özel ders için öğretmen seçin.')
      return
    }
    if (resourceRequired && (!selectedBook || !hasValidResourceSelection)) {
      setError('Soru bankası ödevi için kaynak seçin.')
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
            ) : durationMinutes > 0 ? (
              <p className="mt-1 text-sm font-medium text-panel-text-muted">
                {durationMinutes} dk · saat belirtilmedi
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

        <div className="min-h-[26rem] flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
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
                required
                value={form.taskType}
                onChange={handleTaskTypeChange}
                className="rounded-xl border border-panel-border bg-white p-3 text-base text-panel-text shadow-sm outline-none transition-colors focus:border-panel-blue focus:ring-2 focus:ring-panel-blue-soft"
              >
                <option value="" disabled>
                  Görev türü seçin
                </option>
                <optgroup label="Çalışma Tipleri">
                  {STUDY_TASK_TYPE_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Diğer">
                  {OTHER_TASK_TYPE_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </optgroup>
              </select>
            </label>

            {needsResource ? (
              <div className="flex flex-col gap-2 rounded-2xl border border-panel-border bg-panel-surface-soft/60 p-3">
                <span className="text-sm font-semibold text-panel-text">Soru bankası kaynağı</span>

                {resourceBooksError ? (
                  <p className="rounded-xl bg-panel-accent-soft px-3 py-2 text-sm text-panel-warm">{resourceBooksError}</p>
                ) : resourceBooks === null ? (
                  <p className="rounded-xl bg-white px-3 py-3 text-sm text-panel-text-muted">Kaynaklar yükleniyor...</p>
                ) : activeSubjectGroups.length === 0 ? (
                  <p className="rounded-xl bg-white px-3 py-3 text-sm text-panel-text-muted">
                    Öğrenciye atanmış soru bankası kaynağı yok.
                  </p>
                ) : (
                  <>
                    <select
                      aria-label="Ders"
                      value={effectiveSubjectId}
                      onChange={handleSubjectChange}
                      className="rounded-xl border border-panel-border bg-white p-2.5 text-sm text-panel-text shadow-sm outline-none transition-colors focus:border-panel-blue focus:ring-2 focus:ring-panel-blue-soft"
                    >
                      <option value="">Ders seçin</option>
                      {activeSubjectGroups.map((group) => (
                        <option key={group.id} value={group.id}>
                          {group.name}
                        </option>
                      ))}
                    </select>

                    {!effectiveSubjectId ? (
                      <p className="rounded-xl bg-white px-3 py-3 text-sm text-panel-text-muted">
                        Kaynakları görmek için ders seçin.
                      </p>
                    ) : (
                      <ResourceBookDropdown
                        books={filteredResourceBooks}
                        selectedBook={selectedBook}
                        onSelect={handleSelectResourceBook}
                        placeholder="Kaynak seçin"
                      />
                    )}
                  </>
                )}
              </div>
            ) : null}

            {isSchoolHomework ? (
              <div className="flex flex-col gap-2 rounded-2xl border border-panel-border bg-panel-surface-soft/60 p-3">
                <span className="text-sm font-semibold text-panel-text">Okul kaynağı (isteğe bağlı)</span>

                {schoolResourceGroupsError ? (
                  <p className="rounded-xl bg-panel-accent-soft px-3 py-2 text-sm text-panel-warm">
                    {schoolResourceGroupsError}
                  </p>
                ) : schoolResourceGroups === null ? (
                  <p className="rounded-xl bg-white px-3 py-3 text-sm text-panel-text-muted">Okul kaynakları yükleniyor...</p>
                ) : schoolResourceGroups.length === 0 ? (
                  <p className="rounded-xl bg-white px-3 py-3 text-sm text-panel-text-muted">
                    Öğrencinin okuluna/sınıfına tanımlı okul kaynağı yok. Görevi başlıkla ekleyebilirsiniz.
                  </p>
                ) : (
                  <>
                    <select
                      aria-label="Ders"
                      value={effectiveSchoolSubjectId}
                      onChange={handleSchoolSubjectChange}
                      className="rounded-xl border border-panel-border bg-white p-2.5 text-sm text-panel-text shadow-sm outline-none transition-colors focus:border-panel-blue focus:ring-2 focus:ring-panel-blue-soft"
                    >
                      <option value="">Ders seçin</option>
                      {schoolResourceGroups.map((group) => (
                        <option key={group.subjectId} value={group.subjectId}>
                          {group.subjectName}
                        </option>
                      ))}
                    </select>

                    {!effectiveSchoolSubjectId ? (
                      <p className="rounded-xl bg-white px-3 py-3 text-sm text-panel-text-muted">
                        Kaynakları görmek için ders seçin.
                      </p>
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        <SchoolResourceDropdown
                          resources={schoolResourcesForSubject}
                          selectedResource={selectedSchoolResource}
                          onSelect={handleSelectSchoolResource}
                          placeholder="Kaynak seçin (isteğe bağlı)"
                        />
                        {selectedSchoolResource ? (
                          <button
                            type="button"
                            onClick={handleClearSchoolResource}
                            className="self-start text-xs font-semibold text-panel-blue hover:underline"
                          >
                            Seçimi kaldır
                          </button>
                        ) : null}
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : null}

            {isPrivateLesson ? (
              <div className="flex flex-col gap-2 rounded-2xl border border-panel-border bg-panel-surface-soft/60 p-3">
                {privateTeachersError ? (
                  <p className="rounded-xl bg-panel-accent-soft px-3 py-2 text-sm text-panel-warm">{privateTeachersError}</p>
                ) : privateTeachers === null ? (
                  <p className="rounded-xl bg-white px-3 py-3 text-sm text-panel-text-muted">Öğretmenler yükleniyor...</p>
                ) : lessonSubjectGroups.length === 0 ? (
                  <p className="rounded-xl bg-white px-3 py-3 text-sm text-panel-text-muted">
                    Öğrenciye tanımlı aktif özel öğretmen yok.
                  </p>
                ) : (
                  <>
                    <select
                      aria-label="Ders"
                      value={effectiveLessonSubjectId}
                      onChange={handleLessonSubjectChange}
                      className="rounded-xl border border-panel-border bg-white p-2.5 text-sm text-panel-text shadow-sm outline-none transition-colors focus:border-panel-blue focus:ring-2 focus:ring-panel-blue-soft"
                    >
                      <option value="">Ders seçin</option>
                      {lessonSubjectGroups.map((group) => (
                        <option key={group.id} value={group.id}>
                          {group.name}
                        </option>
                      ))}
                    </select>

                    {effectiveLessonSubjectId ? (
                      <select
                        aria-label="Öğretmen"
                        value={studentTeacherId}
                        onChange={handleTeacherChange}
                        className="rounded-xl border border-panel-border bg-white p-2.5 text-sm text-panel-text shadow-sm outline-none transition-colors focus:border-panel-blue focus:ring-2 focus:ring-panel-blue-soft"
                      >
                        <option value="">Öğretmen seçin</option>
                        {lessonTeachersForSubject.map((teacher) => (
                          <option key={teacher.id} value={teacher.id}>
                            {teacher.fullName}
                          </option>
                        ))}
                      </select>
                    ) : null}
                  </>
                )}
              </div>
            ) : null}

            {showTitleInput ? (
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-panel-text-muted">Görev konusu</span>
                <input
                  value={form.title}
                  onChange={handleChange('title')}
                  className="rounded-xl border border-panel-border bg-white p-3 text-base text-panel-text shadow-sm outline-none transition-colors focus:border-panel-blue focus:ring-2 focus:ring-panel-blue-soft"
                />
              </label>
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

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-panel-text-muted">Gün</span>
                <input
                  required
                  type="date"
                  value={form.date}
                  onChange={handleChange('date')}
                  className="rounded-xl border border-panel-border bg-white p-3 text-base text-panel-text shadow-sm outline-none transition-colors focus:border-panel-blue focus:ring-2 focus:ring-panel-blue-soft"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-panel-text-muted">Saat (isteğe bağlı)</span>
                <input
                  type="time"
                  value={form.startTime}
                  onChange={handleChange('startTime')}
                  className="rounded-xl border border-panel-border bg-white p-3 text-base text-panel-text shadow-sm outline-none transition-colors focus:border-panel-blue focus:ring-2 focus:ring-panel-blue-soft"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-panel-text-muted">Süre (isteğe bağlı)</span>
                <select
                  value={String(durationMode)}
                  onChange={handleDurationSelectChange}
                  className="rounded-xl border border-panel-border bg-white p-3 text-base text-panel-text shadow-sm outline-none transition-colors focus:border-panel-blue focus:ring-2 focus:ring-panel-blue-soft"
                >
                  <option value="">Süre yok</option>
                  {DURATION_OPTIONS.map((minutes) => (
                    <option key={minutes} value={minutes}>
                      {minutes} dk
                    </option>
                  ))}
                  <option value="custom">Özel...</option>
                </select>
              </label>
            </div>

            {durationMode === 'custom' ? (
              <label className="flex flex-col gap-1.5">
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
