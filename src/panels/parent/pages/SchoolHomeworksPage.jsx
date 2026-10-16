import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { School } from 'lucide-react'
import { cachedGet } from '../../../services/authClient'
import { getSchoolHomeworkAccess } from '../../../services/schoolHomeworkService'
import { useAuth } from '../../../context/useAuth'
import PageHeader from '../../layout/PageHeader'
import LoadingState from '../../shared/LoadingState'
import EmptyState from '../../shared/EmptyState'
import SchoolHomeworksView from '../../shared/SchoolHomeworksView'

export default function SchoolHomeworksPage() {
  const { authUser } = useAuth()
  const [searchParams] = useSearchParams()
  const requestedStudentId = searchParams.get('studentId') || ''
  const [students, setStudents] = useState(null)
  const [selectedStudentId, setSelectedStudentId] = useState(requestedStudentId)
  const [studentsError, setStudentsError] = useState('')

  // Seçicide yalnızca okul ödevi olan çocuklar listelenir.
  useEffect(() => {
    let ignore = false
    Promise.all([cachedGet('/api/parent/students'), getSchoolHomeworkAccess(authUser?.id)])
      .then(([data, access]) => {
        if (ignore) return
        const withHomework = new Set((access.studentIds || []).map((id) => String(id).toLowerCase()))
        const list = data.students.filter((student) => withHomework.has(String(student.id).toLowerCase()))
        setStudents(list)
        setSelectedStudentId((current) => {
          if (current && list.some((student) => student.id === current)) return current
          return list[0]?.id || ''
        })
      })
      .catch((err) => {
        if (!ignore) setStudentsError(err.message)
      })
    return () => {
      ignore = true
    }
  }, [authUser?.id])

  if (studentsError) {
    return <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-base text-panel-warm">{studentsError}</div>
  }

  if (students === null) {
    return <LoadingState label="Yükleniyor..." />
  }

  if (!students.length) {
    return (
      <EmptyState
        icon={School}
        title="Okul ödevi bulunamadı"
        description="Çocuğuna okul ödevi tipinde bir görev eklendiğinde burada listelenecek."
      />
    )
  }

  const selectedStudent = students.find((student) => student.id === selectedStudentId) || students[0]

  const headerActions =
    students.length > 1 ? (
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
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Okul Ödevleri"
        subtitle={`${selectedStudent.fullName} için okulda verilen ödevlerin ders ders listesi.`}
        actions={headerActions}
      />
      <SchoolHomeworksView key={selectedStudent.id} studentId={selectedStudent.id} />
    </div>
  )
}
