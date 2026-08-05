import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, CalendarDays, ChevronLeft, ChevronRight, GraduationCap, TrendingUp } from 'lucide-react'
import LoadingState from '../../shared/LoadingState'
import Button from '../../ui/Button'
import WeeklyPlannerGrid from '../../parent/components/WeeklyPlannerGrid'
import AssignTaskModal from '../../shared/homework/AssignTaskModal'
import StudentProgressView from '../../shared/StudentProgressView'
import AssignHomeworkModal from '../components/AssignHomeworkModal'
import TaskDetailModal from '../components/TaskDetailModal'
import {
  getTeacherStudents,
  getTeacherStudentHomeworks,
  getTeacherStudentTasksForDate,
  addTeacherHomework,
  assignTeacherHomeworkTask,
  getTeacherStudentProgressOverview,
} from '../../../services/teacherService'
import { addDaysISO, getMondayOfWeek, todayISODate } from '../../../utils/time'
import { getWeekDates } from '../../../services/weeklyPlanService'

const currentWeekStart = getMondayOfWeek(todayISODate())

export default function StudentDetailPage() {
  const { studentTeacherId } = useParams()
  const [student, setStudent] = useState(null)
  const [studentError, setStudentError] = useState('')
  const [activeTab, setActiveTab] = useState('calendar')

  const [weekOffset, setWeekOffset] = useState(0)
  const weekStart = addDaysISO(currentWeekStart, weekOffset * 7)
  const weekDates = getWeekDates(weekStart)
  const [tasksByDate, setTasksByDate] = useState({})
  const [homeworks, setHomeworks] = useState([])
  const [loadingWeek, setLoadingWeek] = useState(true)
  const [weekError, setWeekError] = useState('')

  const [homeworkModalDate, setHomeworkModalDate] = useState('')
  const [rescheduleHomework, setRescheduleHomework] = useState(null)
  const [detailTask, setDetailTask] = useState(null)
  const [banner, setBanner] = useState('')

  useEffect(() => {
    let ignore = false

    getTeacherStudents()
      .then((data) => {
        if (ignore) return
        const match = data.find((item) => item.studentTeacherId === studentTeacherId)
        setStudent(match || null)
        if (!match) setStudentError('Bu öğrenci bulunamadı ya da erişim yetkiniz yok.')
      })
      .catch((err) => {
        if (!ignore) setStudentError(err.message)
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
    showBanner('Ödev atandı.')
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

  const openRescheduleForTask = (task) => {
    const homework = homeworks.find((item) => item.id === task.homeworkId)
    setDetailTask(null)
    if (homework) setRescheduleHomework(homework)
  }

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
            <span className="mt-1 inline-block rounded-full bg-panel-blue-soft px-2.5 py-1 text-xs font-semibold text-panel-blue">
              {student.subjectName || 'Ders seçilmedi'}
            </span>
          </div>
        </div>
      </div>

      <div className="flex w-fit gap-1 rounded-xl border border-panel-border bg-panel-surface p-1">
        <button
          type="button"
          onClick={() => setActiveTab('calendar')}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
            activeTab === 'calendar' ? 'bg-panel-blue text-white' : 'text-panel-text-muted hover:text-panel-text'
          }`}
        >
          <CalendarDays size={15} aria-hidden="true" />
          Takvim ve Ödevler
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('analysis')}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
            activeTab === 'analysis' ? 'bg-panel-blue text-white' : 'text-panel-text-muted hover:text-panel-text'
          }`}
        >
          <TrendingUp size={15} aria-hidden="true" />
          Ders Analizi
        </button>
      </div>

      {banner ? (
        <div className="rounded-xl bg-panel-sage-soft px-4 py-3 text-base text-panel-text" role="status">
          {banner}
        </div>
      ) : null}

      {activeTab === 'calendar' ? (
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setWeekOffset((current) => current - 1)}
              className="h-11 border-panel-blue-soft px-4 text-sm font-semibold text-panel-text shadow-sm hover:bg-panel-blue-soft/50"
            >
              <ChevronLeft size={18} aria-hidden="true" />
              Önceki Hafta
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setWeekOffset(0)}
              className="h-11 border-panel-blue-soft px-4 text-sm font-semibold text-panel-text shadow-sm hover:bg-panel-blue-soft/50"
            >
              <CalendarDays size={18} aria-hidden="true" />
              Bu Hafta
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setWeekOffset((current) => current + 1)}
              className="h-11 border-panel-blue-soft px-4 text-sm font-semibold text-panel-text shadow-sm hover:bg-panel-blue-soft/50"
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
              onAddHomework={(date) => setHomeworkModalDate(date)}
              onEditTask={handleEditTask}
            />
          )}
        </div>
      ) : (
        <StudentProgressView
          studentId={studentTeacherId}
          title="Ders Analizi"
          emptySubtitle={`${student.subjectName || 'Bu ders'} için ilerleme burada görünecek.`}
          buildSubtitle={() => `${student.subjectName || 'Ders'} için emek, doğruluk ve kaynak ilerlemesi.`}
          fetchOverview={getTeacherStudentProgressOverview}
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
          onReschedule={detailTask.homeworkId ? () => openRescheduleForTask(detailTask) : undefined}
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
    </div>
  )
}
