import { lazy, Suspense, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import LoadingState from '../../shared/LoadingState'
import { useTeacherStudent } from '../../../hooks/useTeacherStudentFocus'
import { getTeacherStudentProgressOverview, makeTeacherMockExamFetchers } from '../../../services/teacherService'

const StudentProgressView = lazy(() => import('../../shared/StudentProgressView'))
const MockExamsView = lazy(() => import('../../shared/MockExamsView'))

// Öğrenciye özel link menüsündeki "Gelişim Analizi" ve "Sınav Sonuçları" sayfaları: öğrenci
// sayfasındaki aynı sekmelerin (StudentDetailPage) ayrı sayfa hali — sunucu öğretmenin dersiyle süzer.
function FocusPageFrame({ children }) {
  return (
    <div className="flex flex-col gap-4">
      <Suspense fallback={<LoadingState label="Yükleniyor..." />}>{children}</Suspense>
    </div>
  )
}

export function TeacherStudentProgressPage() {
  const { studentTeacherId } = useParams()
  const student = useTeacherStudent(studentTeacherId)
  if (!student) return <LoadingState label="Gelişim analizi yükleniyor..." />
  return (
    <FocusPageFrame>
      <StudentProgressView
        studentId={studentTeacherId}
        title="Gelişim Analizi"
        emptySubtitle=""
        buildSubtitle={() => ''}
        fetchOverview={getTeacherStudentProgressOverview}
      />
    </FocusPageFrame>
  )
}

export function TeacherStudentMockExamsPage() {
  const { studentTeacherId } = useParams()
  const student = useTeacherStudent(studentTeacherId)
  const fetchers = useMemo(() => makeTeacherMockExamFetchers(studentTeacherId), [studentTeacherId])
  if (!student) return <LoadingState label="Sınav sonuçları yükleniyor..." />
  return (
    <FocusPageFrame>
      <h1 className="text-2xl font-bold leading-tight text-panel-text sm:text-3xl">Sınav Sonuçları</h1>
      <MockExamsView
        readOnly
        embedded
        fetchMockExams={fetchers.fetchMockExams}
        fetchMockExam={fetchers.fetchMockExam}
        fetchPhoto={fetchers.fetchPhoto}
        fetchTopicStats={fetchers.fetchTopicStats}
        fetchGrowthSummary={fetchers.fetchGrowthSummary}
      />
    </FocusPageFrame>
  )
}
