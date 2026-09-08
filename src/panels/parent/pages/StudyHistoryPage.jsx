import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Users } from 'lucide-react'
import { cachedGet } from '../../../services/authClient'
import PageHeader from '../../layout/PageHeader'
import LoadingState from '../../shared/LoadingState'
import EmptyState from '../../shared/EmptyState'
import StudyHistoryView from '../../shared/StudyHistoryView'

export default function StudyHistoryPage() {
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

  if (studentsError) {
    return <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-base text-panel-warm">{studentsError}</div>
  }

  if (students === null) {
    return <LoadingState label="Yükleniyor..." />
  }

  if (!students.length) {
    return (
      <EmptyState
        icon={Users}
        title="Bağlı öğrenci bulunamadı"
        description="Çalışma geçmişini görebilmek için önce bir öğrenci profili eklemelisin."
      />
    )
  }

  const selectedStudent = students.find((student) => student.id === selectedStudentId) || students[0]
  const activeStudentId = selectedStudent?.id || ''

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
        title="Çalışma Geçmişi"
        subtitle={
          selectedStudent
            ? `${selectedStudent.fullName} için çözülen tüm testler ve optik sonuçları.`
            : 'Çözülen tüm testler ve optik sonuçları.'
        }
        actions={headerActions}
      />

      {/* photoMode="edit": veli çocuğunun yanlış/boş sorularına fotoğraf ekleyebilir ve
          değiştirebilir; canRegrade ile yanlış aktarılmış optiği düzeltebilir. */}
      <StudyHistoryView key={activeStudentId} studentId={activeStudentId} photoMode="edit" canRegrade />
    </div>
  )
}
