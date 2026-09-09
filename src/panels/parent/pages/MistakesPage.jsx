import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Users } from 'lucide-react'
import { cachedGet } from '../../../services/authClient'
import Button from '../../ui/Button'
import {
  getWrongQuestions,
  getWrongQuestionTopicStats,
  getWrongQuestionPhoto,
  updateWrongQuestion,
  updateWrongQuestionPhoto,
} from '../../../services/wrongQuestionService'
import LoadingState from '../../shared/LoadingState'
import EmptyState from '../../shared/EmptyState'
import WrongQuestionsView from '../../shared/WrongQuestionsView'

export default function MistakesPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const requestedStudentId = searchParams.get('studentId') || ''
  const [students, setStudents] = useState(null)
  const [selectedStudentId, setSelectedStudentId] = useState(requestedStudentId)
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
        description="Hata defterini görebilmek için önce bir öğrenci profili eklemelisin."
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
    <WrongQuestionsView
      key={selectedStudent.id}
      fetchWrongQuestions={() => getWrongQuestions(selectedStudent.id)}
      fetchTopicStats={() => getWrongQuestionTopicStats(selectedStudent.id)}
      fetchPhoto={(id) => getWrongQuestionPhoto(id, selectedStudent.id)}
      viewerRole="ebeveyn"
      updateMistakeAnalysis={(id, analysis) => updateWrongQuestion(id, { analysis }, selectedStudent.id)}
      updateMistakeMeta={(id, updates) => updateWrongQuestion(id, updates, selectedStudent.id)}
      updateMistakePhoto={(id, dataUrl) => updateWrongQuestionPhoto(id, dataUrl, selectedStudent.id)}
      title="Hata Defteri"
      subtitle={`${selectedStudent.fullName} için fotoğraflanan yanlış sorular ders ders burada.`}
      headerActions={headerActions}
      backSlot={
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="gap-1.5"
          onClick={() => navigate('/parent/students')}
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Geri
        </Button>
      }
    />
  )
}
