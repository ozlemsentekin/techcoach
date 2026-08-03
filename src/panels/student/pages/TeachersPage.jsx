import { useEffect, useState } from 'react'
import { BookOpen, CalendarDays, Clock, GraduationCap, Phone } from 'lucide-react'
import { authRequest } from '../../../services/authClient'
import PageHeader from '../../layout/PageHeader'
import LoadingState from '../../shared/LoadingState'
import EmptyState from '../../shared/EmptyState'
import { MotionDiv } from '../../ui/motion'

const WEEKDAY_LABELS = {
  pazartesi: 'Pazartesi',
  sali: 'Salı',
  carsamba: 'Çarşamba',
  persembe: 'Perşembe',
  cuma: 'Cuma',
  cumartesi: 'Cumartesi',
  pazar: 'Pazar',
}

function initialsForName(name) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase('tr-TR'))
    .join('')
}

function scheduleLabel(row) {
  const day = WEEKDAY_LABELS[row.dayOfWeek] || row.dayOfWeek
  return `Her ${day} ${row.startTime} - ${row.endTime}`
}

function TeacherProfileCard({ teacher }) {
  const initials = initialsForName(teacher.fullName)
  const hasSchedule = teacher.type === 'ozel_ogretmen' && teacher.schedule?.length > 0

  return (
    <article className="flex min-h-[260px] flex-col gap-4 rounded-xl border border-[#e5e8e9] bg-white p-5 shadow-[0_2px_10px_rgba(20,25,40,0.04)]">
      <div className="flex items-start gap-4">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-student-theme-soft text-xl font-bold text-student-theme-text">
          {initials || <GraduationCap size={26} aria-hidden="true" />}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-bold text-panel-text">{teacher.fullName}</h2>
          <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-panel-text-muted">
            <BookOpen size={15} aria-hidden="true" />
            <span className="truncate">{teacher.subjectName || 'Ders'}</span>
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="rounded-full bg-student-theme-soft px-3 py-1 text-xs font-semibold text-student-theme-text">
          {teacher.typeLabel}
        </span>
        <a
          href={`tel:${teacher.phone.replace(/\s/g, '')}`}
          className="inline-flex items-center gap-1.5 rounded-full bg-[#f3f5f5] px-3 py-1 text-xs font-semibold text-panel-text-muted"
        >
          <Phone size={13} aria-hidden="true" />
          {teacher.phone}
        </a>
      </div>

      <div className="mt-auto flex flex-col gap-2 border-t border-panel-border pt-4">
        <span className="flex items-center gap-2 text-sm font-semibold text-panel-text">
          <CalendarDays size={16} aria-hidden="true" />
          Ders Saatleri
        </span>
        {hasSchedule ? (
          <div className="flex flex-col gap-2">
            {teacher.schedule.map((row, index) => (
              <span
                key={`${row.dayOfWeek}-${row.startTime}-${row.endTime}-${index}`}
                className="inline-flex items-center gap-2 rounded-lg bg-panel-accent-soft px-3 py-2 text-sm font-semibold text-panel-warm"
              >
                <Clock size={14} aria-hidden="true" />
                {scheduleLabel(row)}
              </span>
            ))}
          </div>
        ) : (
          <p className="rounded-lg bg-[#f6f8f8] px-3 py-2 text-sm text-panel-text-muted">Düzenli saat tanımlı değil.</p>
        )}
      </div>
    </article>
  )
}

export default function TeachersPage() {
  const [teachers, setTeachers] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let ignore = false

    authRequest('/api/panel/teachers', { method: 'GET' })
      .then((data) => {
        if (!ignore) setTeachers(data.teachers)
      })
      .catch((err) => {
        if (!ignore) setError(err.message)
      })

    return () => {
      ignore = true
    }
  }, [])

  return (
    <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-5">
      <PageHeader title="Öğretmenlerim" />

      {error ? (
        <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-base text-panel-warm">{error}</div>
      ) : teachers === null ? (
        <LoadingState label="Öğretmenler yükleniyor..." />
      ) : teachers.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="Henüz öğretmen eklenmedi"
          description="Ebeveyn panelinden öğretmen tanımı yapıldığında burada görünür."
        />
      ) : (
        <MotionDiv initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {teachers.map((teacher) => (
            <TeacherProfileCard key={teacher.id} teacher={teacher} />
          ))}
        </MotionDiv>
      )}
    </div>
  )
}
