import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Users } from 'lucide-react'
import { cachedGet } from '../../../services/authClient'
import PageHeader from '../../layout/PageHeader'
import LoadingState from '../../shared/LoadingState'
import EmptyState from '../../shared/EmptyState'
import AiReportsView from '../../shared/AiReportsView'
import { getAiReports, getAiReportScope, getAiReport, createAiReport } from '../../../services/aiAnalysisService'
import { getWrongQuestionPhoto, updateWrongQuestion } from '../../../services/wrongQuestionService'

export default function AiReportsPage() {
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

  const selectedStudent = students?.find((student) => student.id === selectedStudentId) || students?.[0]
  const activeStudentId = selectedStudent?.id || ''

  const fetchReports = useCallback(() => getAiReports(activeStudentId), [activeStudentId])
  const fetchScope = useCallback((subject) => getAiReportScope(subject, activeStudentId), [activeStudentId])
  const fetchReportDetail = useCallback((id) => getAiReport(id, activeStudentId), [activeStudentId])
  const createReport = useCallback((payload) => createAiReport(payload, activeStudentId), [activeStudentId])
  const fetchPhoto = useCallback((id) => getWrongQuestionPhoto(id, activeStudentId), [activeStudentId])
  const updateMistakeAnalysis = useCallback(
    (id, analysis) => updateWrongQuestion(id, { analysis }, activeStudentId),
    [activeStudentId],
  )
  const updateMistakeMeta = useCallback(
    (id, updates) => updateWrongQuestion(id, updates, activeStudentId),
    [activeStudentId],
  )

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
        description="AI raporlarını görebilmek için önce bir öğrenci profili eklemelisin."
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
        title="AI Raporları"
        subtitle={
          selectedStudent
            ? `${selectedStudent.fullName} için hata görsellerinden oluşturulan konu-eksiği analizleri.`
            : 'Hata görsellerinden oluşturulan konu-eksiği analizleri.'
        }
        actions={headerActions}
      />
      <AiReportsView
        key={activeStudentId}
        fetchReports={fetchReports}
        fetchScope={fetchScope}
        fetchReportDetail={fetchReportDetail}
        createReport={createReport}
        fetchPhoto={fetchPhoto}
        updateMistakeAnalysis={updateMistakeAnalysis}
        updateMistakeMeta={updateMistakeMeta}
        viewerRole="ebeveyn"
        canCreate
      />
    </div>
  )
}
