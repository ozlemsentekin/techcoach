import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, CalendarDays, GraduationCap, Users } from 'lucide-react'
import PageHeader from '../../layout/PageHeader'
import EmptyState from '../../shared/EmptyState'
import LoadingState from '../../shared/LoadingState'
import { getTeacherStudents } from '../../../services/teacherService'

const WEEKDAY_SHORT_LABELS = {
  pazartesi: 'Pzt',
  sali: 'Salı',
  carsamba: 'Çrş',
  persembe: 'Prş',
  cuma: 'Cuma',
  cumartesi: 'Cmt',
  pazar: 'Paz',
}

function scheduleText(student) {
  if (student.teacherType !== 'ozel_ogretmen' || !student.schedule?.length) {
    return null
  }
  return student.schedule
    .map((row) => `${WEEKDAY_SHORT_LABELS[row.dayOfWeek] || row.dayOfWeek} ${row.startTime}-${row.endTime}`)
    .join(', ')
}

export default function StudentsPage() {
  const [students, setStudents] = useState(null)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    let ignore = false

    getTeacherStudents()
      .then((data) => {
        if (!ignore) setStudents(data)
      })
      .catch((err) => {
        if (!ignore) setError(err.message)
      })

    return () => {
      ignore = true
    }
  }, [])

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Öğrencilerim" subtitle="Size panel erişimi verilen öğrenciler." />

      {error ? (
        <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-base text-panel-warm">{error}</div>
      ) : students === null ? (
        <LoadingState label="Öğrenciler yükleniyor..." />
      ) : students.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="Henüz öğrenci yok"
          description="Bir veli size panel yetkisi verdiğinde öğrencileri burada listelenir."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {students.map((student) => {
            const schedule = scheduleText(student)
            return (
              <button
                key={student.studentTeacherId}
                type="button"
                onClick={() => navigate(`/teacher/students/${student.studentTeacherId}`)}
                className="flex flex-col gap-3 rounded-2xl border border-panel-border bg-panel-surface p-4 text-left shadow-panel-1 transition-colors hover:border-panel-blue"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-panel-blue-soft text-panel-blue">
                    <GraduationCap size={22} aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-base font-bold text-panel-text">{student.studentFullName}</p>
                    <p className="text-sm text-panel-text-muted">{student.subjectName || 'Ders seçilmedi'}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-panel-surface-soft px-2.5 py-1 text-xs font-semibold text-panel-text-muted">
                    {student.typeLabel}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-panel-surface-soft px-2.5 py-1 text-xs font-semibold text-panel-text-muted">
                    <BookOpen size={12} aria-hidden="true" />
                    {student.resourceCount} kaynak
                  </span>
                </div>

                {schedule ? (
                  <p className="inline-flex items-center gap-1.5 text-sm text-panel-text-muted">
                    <CalendarDays size={14} className="shrink-0" aria-hidden="true" />
                    <span className="truncate">{schedule}</span>
                  </p>
                ) : null}
              </button>
            )
          })}
        </div>
      )}

      {students && students.length > 0 ? (
        <p className="inline-flex items-center gap-1.5 text-sm text-panel-text-muted">
          <Users size={14} aria-hidden="true" />
          {students.length} öğrenci
        </p>
      ) : null}
    </div>
  )
}
