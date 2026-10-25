import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Users } from 'lucide-react'
import { cachedGet } from '../../../services/authClient'
import LoadingState from '../../shared/LoadingState'
import EmptyState from '../../shared/EmptyState'
import PageHeader from '../../layout/PageHeader'
import SubjectProgressAnalysis from '../../shared/SubjectProgressAnalysis'

// Veli "Gelişim Analizi": tek çocuk seçilir, ders bazlı analiz SubjectProgressAnalysis'te
// (öğrencinin "Gelişimim" sayfasıyla ortak).
export default function ProgressPage() {
  const [searchParams] = useSearchParams()
  const requestedStudentId = searchParams.get('studentId') || ''
  const [students, setStudents] = useState(null)
  const [selectedStudentId, setSelectedStudentId] = useState(requestedStudentId)
  const [studentsError, setStudentsError] = useState('')

  useEffect(() => {
    let ignore = false
    cachedGet('/api/parent/students')
      .then((data) => {
        if (ignore) return
        setStudents(data.students)
        setSelectedStudentId((current) => {
          if (current && data.students.some((student) => student.id === current)) return current
          return data.students[0]?.id || ''
        })
      })
      .catch((err) => {
        if (!ignore) setStudentsError(err.message)
      })
    return () => {
      ignore = true
    }
  }, [])

  const selectedStudent = students?.find((student) => student.id === selectedStudentId) || students?.[0] || null

  if (studentsError) {
    return <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-base text-panel-warm">{studentsError}</div>
  }

  if (students === null) {
    return <LoadingState label="Öğrenciler yükleniyor..." />
  }

  if (!students.length) {
    return (
      <EmptyState
        icon={Users}
        title="Bağlı öğrenci bulunamadı"
        description="Gelişim verilerini görebilmek için önce bir öğrenci profili eklemelisin."
      />
    )
  }

  const headerActions =
    students.length > 1 ? (
      <select
        value={selectedStudent?.id || ''}
        onChange={(event) => setSelectedStudentId(event.target.value)}
        className="h-10 rounded-xl border border-panel-border bg-panel-surface px-3 text-sm font-medium text-panel-text"
        aria-label="Öğrenci seç"
      >
        {students.map((student) => (
          <option key={student.id} value={student.id}>
            {student.fullName}
          </option>
        ))}
      </select>
    ) : null

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Gelişim Analizi"
        subtitle={
          selectedStudent
            ? `${selectedStudent.fullName} için tüm derslerin emek, doğruluk ve kaynak ilerlemesi.`
            : 'Tüm derslerin emek, doğruluk ve kaynak ilerlemesi.'
        }
        actions={headerActions}
      />
      {selectedStudent ? (
        <SubjectProgressAnalysis studentId={selectedStudent.id} studentName={selectedStudent.fullName} />
      ) : null}
    </div>
  )
}
