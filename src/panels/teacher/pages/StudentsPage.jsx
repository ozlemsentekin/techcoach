import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  AlertTriangle,
  BookOpen,
  CalendarClock,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  GraduationCap,
  IdCard,
  Phone,
  Plus,
  Power,
  School,
  Trash2,
  TrendingUp,
  Users,
  X,
} from 'lucide-react'
import PageHeader from '../../layout/PageHeader'
import ConfirmationDialog from '../../shared/ConfirmationDialog'
import EmptyState from '../../shared/EmptyState'
import LoadingState from '../../shared/LoadingState'
import { SuccessRateBadge } from '../../shared/ResourceBookCard'
import TaskTypeIcon from '../../shared/TaskTypeIcon'
import ActionsMenu from '../../ui/ActionsMenu'
import Button from '../../ui/Button'
import StudentResourceLibraryModal from '../components/StudentResourceLibraryModal'
import TeacherStudentProfileModal from '../components/TeacherStudentProfileModal'
import {
  deleteTeacherStudent,
  getTeacherEntitlement,
  getTeacherStudentPendingTasks,
  getTeacherStudents,
  updateTeacherStudentGrade,
  updateTeacherStudentStatus,
} from '../../../services/teacherService'
import { formatDateShort } from '../../../utils/time'
import { LIBRARY_GRADES } from '../../shared/library/libraryConstants'
import { TASK_TYPES } from '../../../data/taskTypes'
import { isBacklogTask } from '../../../utils/backlogTasks'
import { getSortedTasks } from '../../../utils/taskSelectors'

const STATUS_FILTERS = [
  { value: 'active', label: 'Aktif' },
  { value: 'all', label: 'Tümü' },
]

function StudentAvatar({ student }) {
  if (student.studentPhotoUrl) {
    return (
      <img loading="lazy" decoding="async"
        src={student.studentPhotoUrl}
        alt={`${student.studentFullName} fotoğrafı`}
        className="h-12 w-12 shrink-0 rounded-xl border border-panel-border object-cover"
      />
    )
  }

  return (
    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-panel-blue-soft text-panel-blue">
      <GraduationCap size={24} aria-hidden="true" />
    </span>
  )
}

function nextLessonText(student) {
  const lesson = student.nextLesson
  if (!lesson) return null
  const weekday = new Date(`${lesson.date}T00:00:00`).toLocaleDateString('tr-TR', { weekday: 'long' })
  return `${formatDateShort(lesson.date)} ${weekday}, ${lesson.startTime}-${lesson.endTime}`
}

function schoolText(student) {
  const grade = student.studentGrade
  const gradeText = grade ? (/^\d+$/.test(grade) ? `${grade}. Sınıf` : grade) : null
  return [student.schoolName, gradeText].filter(Boolean).join(' · ') || null
}

function formatTaskDate(dateISO) {
  if (!dateISO) return 'Tarih eklenmedi'
  return new Date(`${dateISO}T00:00:00`).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    weekday: 'long',
  })
}

function formatTaskTime(task) {
  if (task.startTime && task.endTime) return `${task.startTime}-${task.endTime}`
  if (task.startTime) return task.startTime
  return 'Saat eklenmedi'
}

function taskTitle(task) {
  return task.description || task.title || 'Görev detayı eklenmemiş'
}

function taskProgressText(task) {
  if (task.targetQuestionCount > 0) {
    return `${task.completedQuestionCount || 0}/${task.targetQuestionCount} soru`
  }
  if (task.targetPageCount > 0) {
    return `${task.completedPageCount || 0}/${task.targetPageCount} sayfa`
  }
  return null
}

function taskSourceText(task) {
  if (task.resourceBookName) {
    return [task.publisherName, task.resourceBookName].filter(Boolean).join(' · ')
  }
  return task.schoolResourceName || task.subject || null
}

function PendingTaskItem({ task }) {
  const backlog = isBacklogTask(task)
  const type = TASK_TYPES[task.taskType]
  const typeLabel = type?.label || 'Görev'
  const progress = taskProgressText(task)
  const source = taskSourceText(task)

  return (
    <li
      className={`rounded-lg border p-3 sm:p-3.5 ${
        backlog ? 'border-panel-red/35 bg-panel-red-soft/25' : 'border-panel-border bg-white'
      }`}
    >
      <div className="flex items-start gap-2.5 sm:gap-3">
        <span
          title={typeLabel}
          className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg sm:h-10 sm:w-10 ${
            backlog ? 'bg-panel-red-soft text-panel-red' : 'bg-panel-blue-soft text-panel-blue'
          }`}
        >
          {backlog ? (
            <AlertTriangle size={19} strokeWidth={2.2} aria-hidden="true" />
          ) : (
            <TaskTypeIcon name={type?.icon} size={19} />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-bold leading-snug text-panel-text" title={taskTitle(task)}>
            {taskTitle(task)}
          </p>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-panel-text-muted">
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <CalendarDays size={13} className="shrink-0" aria-hidden="true" />
              <span className="truncate">{formatTaskDate(task.date)}</span>
            </span>
            <span className="inline-flex shrink-0 items-center gap-1.5">
              <CalendarClock size={13} aria-hidden="true" />
              {formatTaskTime(task)}
            </span>
          </div>

          {source || progress || backlog ? (
            <div className="mt-1.5 flex min-w-0 items-center gap-1.5 text-xs font-semibold text-panel-text-muted">
              {backlog ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-panel-red-soft px-1.5 py-0.5 text-panel-red">
                  <AlertTriangle size={11} aria-hidden="true" />
                  Biriken Görev
                </span>
              ) : null}
              {source ? (
                <span className="min-w-0 flex-1 truncate" title={source}>
                  {source}
                </span>
              ) : null}
              {progress ? (
                <span className="shrink-0 rounded-md bg-panel-surface-soft px-1.5 py-0.5 text-panel-text-muted">
                  {progress}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </li>
  )
}

function PendingTasksModal({ student, onClose }) {
  const [tasks, setTasks] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let ignore = false

    getTeacherStudentPendingTasks(student.studentTeacherId)
      .then((data) => {
        if (!ignore) setTasks(getSortedTasks(data || []))
      })
      .catch((err) => {
        if (!ignore) setError(err.message)
      })

    return () => {
      ignore = true
    }
  }, [student.studentTeacherId])

  const backlogCount = tasks ? tasks.filter(isBacklogTask).length : 0

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[calc(100dvh-0.75rem)] w-full max-w-2xl flex-col rounded-t-2xl border border-panel-border bg-panel-surface shadow-panel-1 sm:max-h-[92vh] sm:rounded-2xl">
        <div className="flex items-start justify-between gap-4 p-4 sm:p-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-panel-blue-soft text-panel-blue">
                <ClipboardList size={19} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h2 className="truncate text-lg font-bold text-panel-text">Bekleyen Görevler</h2>
                <p className="mt-0.5 truncate text-sm text-panel-text-muted">
                  {student.studentFullName} · {student.subjectName || 'Ders seçilmedi'}
                </p>
              </div>
            </div>
          </div>
          <button
            type="button"
            aria-label="Kapat"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-panel-text-muted transition-colors hover:bg-panel-surface-soft hover:text-panel-text"
          >
            <X size={19} aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 overflow-y-auto overscroll-contain border-t border-panel-border p-3 sm:p-5">
          {error ? (
            <div className="rounded-lg bg-panel-accent-soft px-4 py-3 text-sm font-semibold text-panel-warm">{error}</div>
          ) : tasks === null ? (
            <LoadingState label="Görevler yükleniyor..." />
          ) : tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-panel-border bg-panel-surface-soft px-6 py-10 text-center">
              <ClipboardList size={28} className="text-panel-text-muted" aria-hidden="true" />
              <h3 className="mt-3 text-base font-bold text-panel-text">Bekleyen görev yok</h3>
              <p className="mt-1 max-w-sm text-sm text-panel-text-muted">
                Bu öğrenci için öğretmen kapsamınızda tamamlanmamış görev bulunmuyor.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-panel-text-muted">
                <span className="rounded-full bg-panel-surface-soft px-2.5 py-1">
                  {tasks.length} tamamlanmamış görev
                </span>
                {backlogCount > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-panel-red-soft px-2.5 py-1 text-panel-red">
                    <AlertTriangle size={12} aria-hidden="true" />
                    {backlogCount} biriken görev
                  </span>
                ) : null}
              </div>
              <ul className="flex flex-col gap-2.5">
                {tasks.map((task) => (
                  <PendingTaskItem key={task.id} task={task} />
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Öğretmen tarafından eklenen öğrencilerin sınıfı boş kalabiliyor; sınıfı olmayan öğrenci
// kütüphanede kaynak atanabilir listesine hiç girmiyor. Bu, o eksikliği panelden tamamlamayı sağlar.
function MissingGradeFix({ student, onSaved }) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleChange = async (event) => {
    const grade = event.target.value
    if (!grade) return
    setSaving(true)
    setError('')
    try {
      await updateTeacherStudentGrade(student.studentTeacherId, grade)
      onSaved(student.studentTeacherId, grade)
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          setEditing(true)
        }}
        className="inline-flex w-fit items-center gap-1.5 rounded-full bg-panel-accent-soft px-2.5 py-1 text-xs font-semibold text-panel-warm"
      >
        <AlertCircle size={12} aria-hidden="true" />
        Sınıf seçilmedi (kaynak ataması için tıklayın)
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-1" onClick={(event) => event.stopPropagation()}>
      <select
        autoFocus
        disabled={saving}
        defaultValue=""
        onChange={handleChange}
        className="w-fit rounded-lg border border-panel-border bg-white px-2 py-1.5 text-sm text-panel-text outline-none focus:border-panel-blue"
      >
        <option value="" disabled>
          Sınıf seçin
        </option>
        {LIBRARY_GRADES.map((grade) => (
          <option key={grade} value={grade}>
            {grade}. Sınıf
          </option>
        ))}
      </select>
      {error ? <span className="text-xs text-panel-warm">{error}</span> : null}
    </div>
  )
}

export default function StudentsPage() {
  const [students, setStudents] = useState(null)
  const [entitlement, setEntitlement] = useState(null)
  const [statusFilter, setStatusFilter] = useState('active')
  const [error, setError] = useState('')
  const [libraryStudent, setLibraryStudent] = useState(null)
  const [profileStudent, setProfileStudent] = useState(null)
  const [pendingTasksStudent, setPendingTasksStudent] = useState(null)
  const [deleteStudent, setDeleteStudent] = useState(null)
  const [actionStudentId, setActionStudentId] = useState(null)
  const [openActionsStudentId, setOpenActionsStudentId] = useState(null)
  const [expandedStudentId, setExpandedStudentId] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    let ignore = false

    getTeacherStudents(statusFilter)
      .then((data) => {
        if (!ignore) setStudents(data)
      })
      .catch((err) => {
        if (!ignore) setError(err.message)
      })

    return () => {
      ignore = true
    }
  }, [statusFilter])

  useEffect(() => {
    let ignore = false

    getTeacherEntitlement()
      .then((data) => {
        if (!ignore) setEntitlement(data)
      })
      .catch((err) => {
        if (!ignore) setError(err.message)
      })

    return () => {
      ignore = true
    }
  }, [])

  const handleStatusChange = async (student, isActive) => {
    setActionStudentId(student.studentTeacherId)
    setError('')
    try {
      const data = await updateTeacherStudentStatus(student.studentTeacherId, isActive)
      setStudents((current) => {
        if (!current) return current
        if (statusFilter === 'active' && !data.student.isActive) {
          return current.filter((item) => item.studentTeacherId !== student.studentTeacherId)
        }
        return current.map((item) =>
          item.studentTeacherId === student.studentTeacherId
            ? { ...item, isActive: data.student.isActive }
            : item,
        )
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setActionStudentId(null)
    }
  }

  const handleGradeSaved = (studentTeacherId, grade) => {
    setStudents((current) =>
      current
        ? current.map((item) => (item.studentTeacherId === studentTeacherId ? { ...item, studentGrade: grade } : item))
        : current,
    )
  }

  const handleDeleteConfirmed = async () => {
    if (!deleteStudent || actionStudentId) return
    setActionStudentId(deleteStudent.studentTeacherId)
    setError('')
    try {
      await deleteTeacherStudent(deleteStudent.studentTeacherId)
      setStudents((current) =>
        current ? current.filter((student) => student.studentTeacherId !== deleteStudent.studentTeacherId) : current,
      )
      setDeleteStudent(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setActionStudentId(null)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Öğrencilerim"
        subtitle="Size panel erişimi verilen öğrenciler."
        actions={
          entitlement?.isActive ? (
            <Button type="button" onClick={() => setProfileStudent('new')}>
              <Plus size={16} aria-hidden="true" />
              Öğrenci Ekle
            </Button>
          ) : null
        }
      />

      <div className="inline-flex w-fit rounded-xl border border-panel-border bg-panel-surface p-1 shadow-sm">
        {STATUS_FILTERS.map((filter) => {
          const selected = statusFilter === filter.value
          return (
            <button
              key={filter.value}
              type="button"
              aria-pressed={selected}
              onClick={() => {
                if (selected) return
                setError('')
                setStudents(null)
                setStatusFilter(filter.value)
              }}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                selected ? 'bg-panel-blue text-white shadow-sm' : 'text-panel-text-muted hover:bg-panel-surface-soft'
              }`}
            >
              {filter.label}
            </button>
          )
        })}
      </div>

      {error ? (
        <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-base text-panel-warm">{error}</div>
      ) : students === null ? (
        <LoadingState label="Öğrenciler yükleniyor..." />
      ) : students.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title={statusFilter === 'active' ? 'Aktif öğrenci yok' : 'Henüz öğrenci yok'}
          description={
            statusFilter === 'active'
              ? 'Pasif öğrencileri görmek için Tümü filtresini seçebilirsiniz.'
              : 'Bir veli size panel yetkisi verdiğinde öğrencileri burada listelenir.'
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {students.map((student) => {
            const lesson = nextLessonText(student)
            const school = schoolText(student)
            const isBusy = actionStudentId === student.studentTeacherId
            const actionItems = [
              {
                label: student.isActive ? 'Pasifle' : 'Aktifle',
                icon: Power,
                onClick: () => handleStatusChange(student, !student.isActive),
              },
              {
                label: 'Sil',
                icon: Trash2,
                danger: true,
                onClick: () => setDeleteStudent(student),
              },
            ]
            const isExpanded = expandedStudentId === student.studentTeacherId
            const goToDetail = () => {
              if (!student.isActive || isBusy) return
              navigate(`/teacher/students/${student.studentTeacherId}`)
            }
            return (
              <div
                key={student.studentTeacherId}
                role={student.isActive ? 'button' : undefined}
                tabIndex={student.isActive ? 0 : undefined}
                onClick={goToDetail}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    goToDetail()
                  }
                }}
                className={`flex flex-col gap-4 rounded-2xl border border-panel-border p-5 shadow-panel-1 transition duration-150 ${
                  student.isActive ? 'bg-panel-surface cursor-pointer hover:-translate-y-0.5 hover:shadow-sm' : 'bg-panel-surface-soft'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <StudentAvatar student={student} />
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-2">
                        <p className="truncate text-base font-bold text-panel-text">{student.studentFullName}</p>
                        {student.isActive ? null : (
                          <span className="shrink-0 rounded-full bg-panel-border px-2 py-0.5 text-xs font-semibold text-panel-text-muted">
                            Pasif
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <p className="truncate text-sm text-panel-text-muted">{student.subjectName || 'Ders seçilmedi'}</p>
                        {student.subjectName ? <SuccessRateBadge value={student.successRate} /> : null}
                      </div>
                    </div>
                  </div>

                  <div onClick={(event) => event.stopPropagation()}>
                    <ActionsMenu
                      isOpen={openActionsStudentId === student.studentTeacherId}
                      onToggle={() =>
                        setOpenActionsStudentId((current) =>
                          current === student.studentTeacherId ? null : student.studentTeacherId,
                        )
                      }
                      onClose={() => setOpenActionsStudentId(null)}
                      triggerLabel={`${student.studentFullName} işlemleri`}
                      disabled={isBusy}
                      items={actionItems}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5 text-sm text-panel-text-muted">
                  {student.studentPhone ? (
                    <p className="inline-flex items-center gap-1.5">
                      <Phone size={14} className="shrink-0" aria-hidden="true" />
                      <span className="truncate">{student.studentPhone}</span>
                    </p>
                  ) : null}
                  {school ? (
                    <p className="inline-flex items-center gap-1.5">
                      <School size={14} className="shrink-0" aria-hidden="true" />
                      <span className="truncate">{school}</span>
                    </p>
                  ) : null}
                  {!student.studentGrade ? (
                    <MissingGradeFix student={student} onSaved={handleGradeSaved} />
                  ) : null}
                  {lesson ? (
                    <p className="inline-flex w-fit items-center gap-1.5 rounded-lg bg-panel-blue-soft px-2 py-1 text-xs font-bold text-panel-blue">
                      <CalendarDays size={14} className="shrink-0" aria-hidden="true" />
                      <span className="truncate">{lesson}</span>
                    </p>
                  ) : null}
                  <p className="inline-flex items-center gap-1.5">
                    <BookOpen size={14} className="shrink-0" aria-hidden="true" />
                    <span className="truncate">{student.resourceCount} kaynak</span>
                  </p>
                </div>

                <div className="mt-auto" onClick={(event) => event.stopPropagation()}>
                  <button
                    type="button"
                    aria-expanded={isExpanded}
                    disabled={!student.isActive || isBusy}
                    onClick={() =>
                      setExpandedStudentId((current) =>
                        current === student.studentTeacherId ? null : student.studentTeacherId,
                      )
                    }
                    className="flex w-full items-center justify-between rounded-lg border border-panel-border bg-panel-surface-soft px-3 py-2 text-[13px] font-semibold text-panel-text transition-colors hover:bg-panel-border/40 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span>İşlemler</span>
                    <ChevronDown
                      size={16}
                      aria-hidden="true"
                      className={`shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {isExpanded ? (
                <div className="mt-2 grid grid-cols-1 gap-2 xl:grid-cols-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setProfileStudent(student)}
                    disabled={!student.isActive || isBusy}
                    className="h-10 w-full justify-start rounded-lg px-3 text-left text-[13px] font-semibold"
                  >
                    <IdCard size={16} className="shrink-0" aria-hidden="true" />
                    <span className="min-w-0 truncate">Profil Kartı</span>
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => navigate(`/teacher/students/${student.studentTeacherId}`)}
                    disabled={!student.isActive || isBusy}
                    className="h-10 w-full justify-start rounded-lg px-3 text-left text-[13px] font-semibold"
                  >
                    <CalendarClock size={16} className="shrink-0" aria-hidden="true" />
                    <span className="min-w-0 truncate">Çalışma Takvimi</span>
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setPendingTasksStudent(student)}
                    disabled={!student.isActive || isBusy}
                    className="h-10 w-full justify-start rounded-lg border-panel-blue-soft px-3 text-left text-[13px] font-semibold text-panel-blue"
                  >
                    <ClipboardList size={16} className="shrink-0" aria-hidden="true" />
                    <span className="min-w-0 truncate">Bekleyen Görevler</span>
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => navigate(`/teacher/students/${student.studentTeacherId}?tab=mistakes`)}
                    disabled={!student.isActive || isBusy}
                    className="h-10 w-full justify-start rounded-lg px-3 text-left text-[13px] font-semibold"
                  >
                    <AlertCircle size={16} className="shrink-0" aria-hidden="true" />
                    <span className="min-w-0 truncate">Dijital Hata Defteri</span>
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setLibraryStudent(student)}
                    disabled={!student.isActive || isBusy}
                    className="h-10 w-full justify-start rounded-lg px-3 text-left text-[13px] font-semibold"
                  >
                    <BookOpen size={16} className="shrink-0" aria-hidden="true" />
                    <span className="min-w-0 truncate">Kaynaklar</span>
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => navigate(`/teacher/students/${student.studentTeacherId}?tab=analysis`)}
                    disabled={!student.isActive || isBusy}
                    className="h-10 w-full justify-start rounded-lg px-3 text-left text-[13px] font-semibold"
                  >
                    <TrendingUp size={16} className="shrink-0" aria-hidden="true" />
                    <span className="min-w-0 truncate">Gelişim Analizi</span>
                  </Button>
                </div>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {students && students.length > 0 ? (
        <p className="inline-flex items-center gap-1.5 text-sm text-panel-text-muted">
          <Users size={14} aria-hidden="true" />
          {statusFilter === 'active' ? `${students.length} aktif öğrenci` : `${students.length} öğrenci kaydı`}
        </p>
      ) : null}

      {libraryStudent ? (
        <StudentResourceLibraryModal
          student={libraryStudent}
          onClose={() => setLibraryStudent(null)}
          onAssigned={() => {
            getTeacherStudents(statusFilter)
              .then(setStudents)
              .catch((err) => setError(err.message))
          }}
        />
      ) : null}

      {profileStudent ? (
        <TeacherStudentProfileModal
          student={profileStudent === 'new' ? null : profileStudent}
          onClose={() => setProfileStudent(null)}
          onChanged={() => {
            getTeacherStudents(statusFilter)
              .then(setStudents)
              .catch((err) => setError(err.message))
          }}
        />
      ) : null}

      {pendingTasksStudent ? (
        <PendingTasksModal
          key={pendingTasksStudent.studentTeacherId}
          student={pendingTasksStudent}
          onClose={() => setPendingTasksStudent(null)}
        />
      ) : null}

      {deleteStudent ? (
        <ConfirmationDialog
          title="Öğrenciyi Sil"
          description={`${deleteStudent.studentFullName} için öğretmen bağlantısı ve bu bağlantıya ait veriler kalıcı silinecek. Öğretmen kotasından oluşturulmuşsa öğrenci hesabı da silinir.`}
          confirmLabel={actionStudentId === deleteStudent.studentTeacherId ? 'Siliniyor...' : 'Sil'}
          onConfirm={handleDeleteConfirmed}
          onCancel={() => {
            if (!actionStudentId) setDeleteStudent(null)
          }}
        />
      ) : null}
    </div>
  )
}
