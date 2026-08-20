import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, BookOpen, CalendarDays, GraduationCap, Phone, Plus, School, TrendingUp, UserRound, Users } from 'lucide-react'
import PageHeader from '../../layout/PageHeader'
import EmptyState from '../../shared/EmptyState'
import LoadingState from '../../shared/LoadingState'
import { SuccessRateBadge } from '../../shared/ResourceBookCard'
import Button from '../../ui/Button'
import StudentResourceLibraryModal from '../components/StudentResourceLibraryModal'
import AddTeacherStudentModal from '../components/AddTeacherStudentModal'
import { getTeacherStudents } from '../../../services/teacherService'
import { formatDateShort } from '../../../utils/time'

function StudentAvatar({ student }) {
  if (student.studentPhotoUrl) {
    return (
      <img
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

export default function StudentsPage() {
  const [students, setStudents] = useState(null)
  const [error, setError] = useState('')
  const [libraryStudent, setLibraryStudent] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
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
      <PageHeader
        title="Öğrencilerim"
        subtitle="Size panel erişimi verilen öğrenciler."
        actions={
          <Button type="button" onClick={() => setShowAddModal(true)}>
            <Plus size={16} aria-hidden="true" />
            Öğrenci Ekle
          </Button>
        }
      />

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
            const lesson = nextLessonText(student)
            const school = schoolText(student)
            return (
              <div
                key={student.studentTeacherId}
                className="flex flex-col gap-4 rounded-2xl border border-panel-border bg-panel-surface p-5 shadow-panel-1"
              >
                <div className="flex items-center gap-3">
                  <StudentAvatar student={student} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-bold text-panel-text">{student.studentFullName}</p>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <p className="truncate text-sm text-panel-text-muted">{student.subjectName || 'Ders seçilmedi'}</p>
                      {student.subjectName ? <SuccessRateBadge value={student.successRate} /> : null}
                    </div>
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
                  {lesson ? (
                    <p className="inline-flex items-center gap-1.5">
                      <CalendarDays size={14} className="shrink-0" aria-hidden="true" />
                      <span className="truncate">{lesson}</span>
                    </p>
                  ) : null}
                  <p className="inline-flex items-center gap-1.5">
                    <BookOpen size={14} className="shrink-0" aria-hidden="true" />
                    <span className="truncate">{student.resourceCount} kaynak</span>
                  </p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => navigate(`/teacher/students/${student.studentTeacherId}`)}
                    className="h-auto w-full justify-start gap-2.5 px-3 py-2"
                  >
                    <UserRound size={16} className="shrink-0" aria-hidden="true" />
                    Detay
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setLibraryStudent(student)}
                    className="h-auto w-full justify-start gap-2.5 px-3 py-2"
                  >
                    <BookOpen size={16} className="shrink-0" aria-hidden="true" />
                    Kaynaklar
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => navigate(`/teacher/students/${student.studentTeacherId}?tab=mistakes`)}
                    className="h-auto w-full justify-start gap-2.5 px-3 py-2"
                  >
                    <AlertCircle size={16} className="shrink-0" aria-hidden="true" />
                    Hata Defteri
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => navigate(`/teacher/students/${student.studentTeacherId}?tab=analysis`)}
                    className="h-auto w-full justify-start gap-2.5 px-3 py-2"
                  >
                    <TrendingUp size={16} className="shrink-0" aria-hidden="true" />
                    Gelişim Analizi
                  </Button>
                </div>
              </div>
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

      {libraryStudent ? (
        <StudentResourceLibraryModal student={libraryStudent} onClose={() => setLibraryStudent(null)} />
      ) : null}

      {showAddModal ? (
        <AddTeacherStudentModal
          onCreated={() => {
            setShowAddModal(false)
            setStudents(null)
            getTeacherStudents()
              .then(setStudents)
              .catch((err) => setError(err.message))
          }}
          onClose={() => setShowAddModal(false)}
        />
      ) : null}
    </div>
  )
}
