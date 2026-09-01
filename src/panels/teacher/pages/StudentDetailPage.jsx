import { useCallback, useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { AlertCircle, ArrowLeft, CalendarDays, ChevronLeft, ChevronRight, GraduationCap, Phone, TrendingUp } from 'lucide-react'
import LoadingState from '../../shared/LoadingState'
import Button from '../../ui/Button'
import WeeklyPlannerGrid from '../../parent/components/WeeklyPlannerGrid'
import AssignTaskModal from '../../shared/homework/AssignTaskModal'
import StudentProgressView from '../../shared/StudentProgressView'
import WrongQuestionsView from '../../shared/WrongQuestionsView'
import AssignHomeworkModal from '../components/AssignHomeworkModal'
import EditHomeworkModal from '../components/EditHomeworkModal'
import TaskDetailModal from '../components/TaskDetailModal'
import TaskOpticalResultModal from '../components/TaskOpticalResultModal'
import ScheduleSlotModal from '../components/ScheduleSlotModal'
import ConfirmationDialog from '../../shared/ConfirmationDialog'
import {
  getTeacherStudent,
  getTeacherStudentHomeworks,
  getTeacherStudentTasksForDate,
  getTeacherStudentSchoolSchedule,
  addTeacherHomework,
  assignTeacherHomeworkTask,
  updateTeacherHomework,
  deleteTeacherHomework,
  getTeacherStudentProgressOverview,
  getTeacherStudentWrongQuestions,
  getTeacherStudentWrongQuestionTopicStats,
  getTeacherStudentWrongQuestionPhoto,
  updateTeacherStudentWrongQuestion,
  updateTeacherStudentTask,
  deleteTeacherStudentTask,
} from '../../../services/teacherService'
import { addDaysISO, getMondayOfWeek, todayISODate } from '../../../utils/time'
import { getWeekDates } from '../../../services/weeklyPlanService'
import { HOMEWORK_TASK_TYPES } from '../../../data/taskTypes'

const currentWeekStart = getMondayOfWeek(todayISODate())

const VALID_TABS = ['calendar', 'analysis', 'mistakes']

export default function StudentDetailPage() {
  const { studentTeacherId } = useParams()
  const [searchParams] = useSearchParams()
  const [student, setStudent] = useState(null)
  const [studentError, setStudentError] = useState('')
  const [activeTab, setActiveTab] = useState(() => {
    const requestedTab = searchParams.get('tab')
    return VALID_TABS.includes(requestedTab) ? requestedTab : 'calendar'
  })

  const [weekOffset, setWeekOffset] = useState(0)
  const weekStart = addDaysISO(currentWeekStart, weekOffset * 7)
  const weekDates = getWeekDates(weekStart)
  const [tasksByDate, setTasksByDate] = useState({})
  const [schoolSchedule, setSchoolSchedule] = useState([])
  const [schoolHolidays, setSchoolHolidays] = useState([])
  const [homeworks, setHomeworks] = useState([])
  const [loadingWeek, setLoadingWeek] = useState(true)
  const [weekError, setWeekError] = useState('')

  const [homeworkModalDate, setHomeworkModalDate] = useState('')
  const [rescheduleHomework, setRescheduleHomework] = useState(null)
  const [editingHomework, setEditingHomework] = useState(null)
  const [deletingHomework, setDeletingHomework] = useState(null)
  const [reschedulingTask, setReschedulingTask] = useState(null)
  const [deletingTask, setDeletingTask] = useState(null)
  const [detailTask, setDetailTask] = useState(null)
  const [answerSheetTask, setAnswerSheetTask] = useState(null)
  const [managingSlot, setManagingSlot] = useState(null)
  const [banner, setBanner] = useState('')

  const refreshStudent = async () => {
    setStudent(await getTeacherStudent(studentTeacherId))
  }

  useEffect(() => {
    let ignore = false

    getTeacherStudent(studentTeacherId)
      .then((data) => {
        if (ignore) return
        setStudent(data)
      })
      .catch((err) => {
        if (!ignore) setStudentError(err.message)
      })

    getTeacherStudentSchoolSchedule(studentTeacherId)
      .then((data) => {
        if (ignore) return
        setSchoolSchedule(data.entries)
        setSchoolHolidays(data.holidays)
      })
      .catch(() => {
        if (ignore) return
        setSchoolSchedule([])
        setSchoolHolidays([])
      })

    return () => {
      ignore = true
    }
  }, [studentTeacherId])

  const refreshWeek = async () => {
    const [homeworkList, ...dayTasks] = await Promise.all([
      getTeacherStudentHomeworks(studentTeacherId),
      ...weekDates.map((date) => getTeacherStudentTasksForDate(studentTeacherId, date)),
    ])
    setHomeworks(homeworkList)
    setTasksByDate(Object.fromEntries(weekDates.map((date, index) => [date, dayTasks[index]])))
  }

  useEffect(() => {
    let ignore = false
    setLoadingWeek(true)
    setWeekError('')

    refreshWeek()
      .catch((err) => {
        if (!ignore) setWeekError(err.message)
      })
      .finally(() => {
        if (!ignore) setLoadingWeek(false)
      })

    return () => {
      ignore = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentTeacherId, weekOffset])

  const showBanner = (text) => {
    setBanner(text)
    window.setTimeout(() => setBanner(''), 4000)
  }

  const handleSaveHomework = async (payload) => {
    await addTeacherHomework(studentTeacherId, payload)
    await refreshWeek()
    setHomeworkModalDate('')
    showBanner('Görev atandı.')
  }

  const handleReschedule = async ({ date, startTime, durationMinutes }) => {
    await assignTeacherHomeworkTask(studentTeacherId, rescheduleHomework.id, { date, startTime, durationMinutes })
    await refreshWeek()
    setRescheduleHomework(null)
    showBanner('Görev planlandı.')
  }

  const handleEditTask = (task) => {
    setDetailTask(task)
  }

  // Ödev kaydına bağlı olmayan (homeworkId yok) ama öğretmenin takip ettiği kaynağa ait,
  // öğrenci/veli eklemiş plan görevleri: görev tabanlı uçlarla yeniden planlanır/silinir.
  const isManageableStandaloneTask = (task) =>
    Boolean(task) && !task.homeworkId && HOMEWORK_TASK_TYPES.has(task.taskType)

  const handleTaskReschedule = async ({ date, startTime, durationMinutes }) => {
    await updateTeacherStudentTask(studentTeacherId, reschedulingTask.id, { date, startTime, durationMinutes })
    await refreshWeek()
    setReschedulingTask(null)
    showBanner('Görev yeniden planlandı.')
  }

  const handleTaskDeleteConfirmed = async () => {
    const taskId = deletingTask?.id
    setDeletingTask(null)
    try {
      await deleteTeacherStudentTask(studentTeacherId, taskId)
      await refreshWeek()
      showBanner('Görev silindi.')
    } catch (err) {
      setWeekError(err.message)
    }
  }

  const openRescheduleForTask = (task) => {
    const homework = homeworks.find((item) => item.id === task.homeworkId)
    setDetailTask(null)
    if (homework) setRescheduleHomework(homework)
  }

  const openEditForTask = (task) => {
    const homework = homeworks.find((item) => item.id === task.homeworkId)
    setDetailTask(null)
    if (homework) setEditingHomework(homework)
  }

  const openDeleteForTask = (task) => {
    const homework = homeworks.find((item) => item.id === task.homeworkId)
    setDetailTask(null)
    if (homework) setDeletingHomework(homework)
  }

  const handleEditHomeworkSave = async (updates) => {
    await updateTeacherHomework(studentTeacherId, editingHomework.id, updates)
    await refreshWeek()
    setEditingHomework(null)
    showBanner('Görev güncellendi.')
  }

  const handleDeleteHomeworkConfirmed = async () => {
    const homeworkId = deletingHomework?.id
    setDeletingHomework(null)
    try {
      await deleteTeacherHomework(studentTeacherId, homeworkId)
      await refreshWeek()
      showBanner('Görev silindi.')
    } catch (err) {
      setWeekError(err.message)
    }
  }

  const fetchWrongQuestions = useCallback(
    () => getTeacherStudentWrongQuestions(studentTeacherId),
    [studentTeacherId],
  )
  const fetchTopicStats = useCallback(
    () => getTeacherStudentWrongQuestionTopicStats(studentTeacherId),
    [studentTeacherId],
  )
  const fetchPhoto = useCallback(
    (id) => getTeacherStudentWrongQuestionPhoto(studentTeacherId, id),
    [studentTeacherId],
  )
  const updateMistakeReason = useCallback(
    (id, mistakeReason) => updateTeacherStudentWrongQuestion(studentTeacherId, id, { mistakeReason }),
    [studentTeacherId],
  )
  const updateMistakeMeta = useCallback(
    (id, updates) => updateTeacherStudentWrongQuestion(studentTeacherId, id, updates),
    [studentTeacherId],
  )

  if (studentError) {
    return (
      <div className="flex flex-col gap-4">
        <Link to="/teacher/students" className="inline-flex items-center gap-1.5 text-sm font-semibold text-panel-blue">
          <ArrowLeft size={16} aria-hidden="true" />
          Öğrencilerime Dön
        </Link>
        <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-base text-panel-warm">{studentError}</div>
      </div>
    )
  }

  if (!student) {
    return <LoadingState label="Öğrenci yükleniyor..." />
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Link to="/teacher/students" className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-panel-blue">
          <ArrowLeft size={16} aria-hidden="true" />
          Öğrencilerime Dön
        </Link>
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-panel-blue-soft text-panel-blue">
            <GraduationCap size={24} aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-panel-text">{student.studentFullName}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="inline-block rounded-full bg-panel-blue-soft px-2.5 py-1 text-xs font-semibold text-panel-blue">
                {student.subjectName || 'Ders seçilmedi'}
              </span>
              {student.studentGrade ? (
                <span className="inline-block rounded-full bg-panel-surface-soft px-2.5 py-1 text-xs font-semibold text-panel-text-muted">
                  {/^\d+$/.test(student.studentGrade) ? `${student.studentGrade}. Sınıf` : student.studentGrade}
                </span>
              ) : null}
              {student.studentPhone ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-panel-surface-soft px-2.5 py-1 text-xs font-semibold text-panel-text-muted">
                  <Phone size={12} aria-hidden="true" />
                  {student.studentPhone}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="flex w-full gap-1 overflow-x-auto rounded-xl border border-panel-border bg-panel-surface p-1 sm:w-fit">
        <button
          type="button"
          onClick={() => setActiveTab('calendar')}
          className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
            activeTab === 'calendar' ? 'bg-panel-blue text-white' : 'text-panel-text-muted hover:text-panel-text'
          }`}
        >
          <CalendarDays size={15} aria-hidden="true" />
          Takvim
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('analysis')}
          className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
            activeTab === 'analysis' ? 'bg-panel-blue text-white' : 'text-panel-text-muted hover:text-panel-text'
          }`}
        >
          <TrendingUp size={15} aria-hidden="true" />
          Gelişim Analizi
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('mistakes')}
          className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
            activeTab === 'mistakes' ? 'bg-panel-blue text-white' : 'text-panel-text-muted hover:text-panel-text'
          }`}
        >
          <AlertCircle size={15} aria-hidden="true" />
          Hata Defteri
        </button>
      </div>

      {banner ? (
        <div className="rounded-xl bg-panel-sage-soft px-4 py-3 text-base text-panel-text" role="status">
          {banner}
        </div>
      ) : null}

      {activeTab === 'calendar' ? (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setWeekOffset((current) => current - 1)}
              className="h-11 w-full border-panel-blue-soft px-3 text-sm font-semibold text-panel-text shadow-sm hover:bg-panel-blue-soft/50 sm:w-auto sm:px-4"
            >
              <ChevronLeft size={18} aria-hidden="true" />
              Önceki Hafta
            </Button>
            <Button
              type="button"
              variant={weekOffset === 0 ? 'primary' : 'secondary'}
              onClick={() => setWeekOffset(0)}
              className={
                weekOffset === 0
                  ? 'h-11 w-full px-3 text-sm font-semibold sm:w-auto sm:px-4'
                  : 'h-11 w-full border-panel-blue-soft px-3 text-sm font-semibold text-panel-text shadow-sm hover:bg-panel-blue-soft/50 sm:w-auto sm:px-4'
              }
            >
              <CalendarDays size={18} aria-hidden="true" />
              Bu Hafta
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setWeekOffset((current) => current + 1)}
              className="h-11 w-full border-panel-blue-soft px-3 text-sm font-semibold text-panel-text shadow-sm hover:bg-panel-blue-soft/50 sm:w-auto sm:px-4"
            >
              Sonraki Hafta
              <ChevronRight size={18} aria-hidden="true" />
            </Button>
          </div>

          {weekError ? (
            <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-base text-panel-warm">{weekError}</div>
          ) : null}

          {loadingWeek ? (
            <LoadingState label="Takvim yükleniyor..." />
          ) : (
            <WeeklyPlannerGrid
              weekDates={weekDates}
              tasksByDate={tasksByDate}
              lessonSchedule={student.schedule}
              lessonScheduleExceptions={student.scheduleExceptions}
              schoolSchedule={schoolSchedule}
              schoolHolidays={schoolHolidays}
              onAddHomework={(date) => setHomeworkModalDate(date)}
              onEditTask={handleEditTask}
              onViewAnswerSheet={setAnswerSheetTask}
              onManageLessonSlot={(slot) => setManagingSlot(slot)}
              canEditTask={(task) => task.createdBy === 'ogretmen' || isManageableStandaloneTask(task)}
            />
          )}
        </div>
      ) : activeTab === 'analysis' ? (
        <StudentProgressView
          studentId={studentTeacherId}
          title="Gelişim Analizi"
          emptySubtitle={`${student.subjectName || 'Bu ders'} için ilerleme burada görünecek.`}
          buildSubtitle={(subjectLabel) => `${subjectLabel} için emek, doğruluk ve kaynak ilerlemesi.`}
          fetchOverview={getTeacherStudentProgressOverview}
        />
      ) : (
        <WrongQuestionsView
          fetchWrongQuestions={fetchWrongQuestions}
          fetchTopicStats={fetchTopicStats}
          fetchPhoto={fetchPhoto}
          updateMistakeReason={updateMistakeReason}
          updateMistakeMeta={updateMistakeMeta}
          hideHeaderWhenUnselected
        />
      )}

      {homeworkModalDate ? (
        <AssignHomeworkModal
          studentTeacherId={studentTeacherId}
          subjectName={student.subjectName}
          defaultTaskDate={homeworkModalDate}
          onSave={handleSaveHomework}
          onClose={() => setHomeworkModalDate('')}
        />
      ) : null}

      {detailTask ? (
        <TaskDetailModal
          task={detailTask}
          onReschedule={
            detailTask.homeworkId
              ? () => openRescheduleForTask(detailTask)
              : isManageableStandaloneTask(detailTask)
                ? () => {
                    setReschedulingTask(detailTask)
                    setDetailTask(null)
                  }
                : undefined
          }
          onEdit={detailTask.homeworkId ? () => openEditForTask(detailTask) : undefined}
          onDelete={
            detailTask.homeworkId
              ? () => openDeleteForTask(detailTask)
              : isManageableStandaloneTask(detailTask)
                ? () => {
                    setDeletingTask(detailTask)
                    setDetailTask(null)
                  }
                : undefined
          }
          onClose={() => setDetailTask(null)}
        />
      ) : null}

      {rescheduleHomework ? (
        <AssignTaskModal
          homework={rescheduleHomework}
          onSave={handleReschedule}
          onClose={() => setRescheduleHomework(null)}
        />
      ) : null}

      {reschedulingTask ? (
        <AssignTaskModal
          homework={{
            title: reschedulingTask.description || reschedulingTask.title,
            hasTask: true,
            taskDate: reschedulingTask.date,
            taskStartTime: reschedulingTask.startTime,
            taskDurationMinutes: reschedulingTask.durationMinutes,
          }}
          onSave={handleTaskReschedule}
          onClose={() => setReschedulingTask(null)}
        />
      ) : null}

      {deletingTask ? (
        <ConfirmationDialog
          title="Görevi sil"
          description={`"${deletingTask.description || deletingTask.title}" görevini plandan silmek istediğine emin misin?`}
          confirmLabel="Sil"
          cancelLabel="Vazgeç"
          onConfirm={handleTaskDeleteConfirmed}
          onCancel={() => setDeletingTask(null)}
        />
      ) : null}

      {editingHomework ? (
        <EditHomeworkModal
          studentTeacherId={studentTeacherId}
          homework={editingHomework}
          onSave={handleEditHomeworkSave}
          onClose={() => setEditingHomework(null)}
        />
      ) : null}

      {deletingHomework ? (
        <ConfirmationDialog
          title="Görevi sil"
          description={`"${deletingHomework.title}" görevini silmek istediğine emin misin?`}
          confirmLabel="Sil"
          cancelLabel="Vazgeç"
          onConfirm={handleDeleteHomeworkConfirmed}
          onCancel={() => setDeletingHomework(null)}
        />
      ) : null}

      {answerSheetTask ? (
        <TaskOpticalResultModal
          task={answerSheetTask}
          studentTeacherId={studentTeacherId}
          onClose={() => setAnswerSheetTask(null)}
        />
      ) : null}

      {managingSlot ? (
        <ScheduleSlotModal
          studentTeacherId={studentTeacherId}
          slot={managingSlot}
          onDone={async () => {
            await Promise.all([refreshWeek(), refreshStudent()])
            setManagingSlot(null)
          }}
          onClose={() => setManagingSlot(null)}
        />
      ) : null}
    </div>
  )
}
