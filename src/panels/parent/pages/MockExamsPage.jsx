import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Users } from 'lucide-react'
import { cachedGet } from '../../../services/authClient'
import LoadingState from '../../shared/LoadingState'
import EmptyState from '../../shared/EmptyState'
import PageHeader from '../../layout/PageHeader'
import MockExamsView from '../../shared/MockExamsView'
import {
  getMockExams,
  getMockExam,
  getMockExamPhoto,
  createMockExam,
  updateMockExam,
  deleteMockExam,
  addMockExamPhoto,
  deleteMockExamPhoto,
} from '../../../services/mockExamService'

export default function MockExamsPage() {
  const [searchParams] = useSearchParams()
  const [students, setStudents] = useState(null)
  const [selectedStudentId, setSelectedStudentId] = useState(searchParams.get('studentId') || '')
  const [error, setError] = useState('')

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
        description="Deneme sınavı sonuçlarını görebilmek için önce bir öğrenci profili eklemelisin."
      />
    )
  }

  const selectedStudent = students.find((student) => student.id === selectedStudentId) || students[0]

  return (
    <div className="flex flex-col gap-4">
      {students.length > 1 ? (
        <PageHeader
          title="Deneme Sınavları"
          subtitle="Branş İzleme, Genel Deneme ve Etüt sonuçları."
          actions={
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
          }
        />
      ) : null}
      <MockExamsView
        key={selectedStudent.id}
        studentId={selectedStudent.id}
        embedded={students.length > 1}
        fetchMockExams={getMockExams}
        fetchMockExam={getMockExam}
        fetchPhoto={getMockExamPhoto}
        createMockExam={createMockExam}
        updateMockExam={updateMockExam}
        deleteMockExam={deleteMockExam}
        addPhoto={addMockExamPhoto}
        deletePhoto={deleteMockExamPhoto}
      />
    </div>
  )
}
