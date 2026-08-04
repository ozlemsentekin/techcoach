import { useEffect, useState } from 'react'
import { Users } from 'lucide-react'
import { authRequest } from '../../../services/authClient'
import LoadingState from '../../shared/LoadingState'
import EmptyState from '../../shared/EmptyState'
import StudentProgressView from '../../shared/StudentProgressView'

export default function ProgressPage() {
  const [students, setStudents] = useState(null)
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let ignore = false

    authRequest('/api/parent/students', { method: 'GET' })
      .then((data) => {
        if (ignore) return
        setStudents(data.students)
        setSelectedStudentId((current) => current || data.students[0]?.id || '')
      })
      .catch((err) => {
        if (!ignore) setError(err.message)
      })

    return () => {
      ignore = true
    }
  }, [])

  if (error) {
    return <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-base text-panel-warm">{error}</div>
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

  const selectedStudent = students.find((student) => student.id === selectedStudentId) || students[0]

  const studentPicker = students.length > 1 ? (
    <select
      value={selectedStudent.id}
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
    <StudentProgressView
      key={selectedStudent.id}
      studentId={selectedStudent.id}
      title="Gelişim"
      emptySubtitle={`${selectedStudent.fullName} için gösterilecek ders bulunamadı.`}
      buildSubtitle={(subjectLabel) => `${selectedStudent.fullName} için ${subjectLabel} bazında emek, doğruluk ve kaynak ilerlemesi.`}
      headerActions={studentPicker}
    />
  )
}
