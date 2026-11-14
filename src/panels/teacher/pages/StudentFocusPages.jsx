import { lazy, Suspense, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import LoadingState from '../../shared/LoadingState'
import { useTeacherStudent } from '../../../hooks/useTeacherStudentFocus'
import { getTeacherStudentProgressOverview, makeTeacherMockExamFetchers } from '../../../services/teacherService'

const StudentProgressView = lazy(() => import('../../shared/StudentProgressView'))
const MockExamsView = lazy(() => import('../../shared/MockExamsView'))

// Öğrenciye özel link menüsündeki "Gelişim Analizi" ve "Sınav Sonuçları" sayfaları: öğrenci
// sayfasındaki aynı sekmelerin (StudentDetailPage) ayrı sayfa hali — sunucu öğretmenin dersiyle süzer.
function FocusPageFrame({ studentTeacherId, children }) {
  return (
    <div className="flex flex-col gap-4">
      <Link
        to={`/teacher/students/${studentTeacherId}`}
        className="inline-flex w-fit items-center gap-1 text-sm text-panel-text-muted hover:text-panel-text"
      >
        <ArrowLeft size={16} /> Öğrenci sayfası
      </Link>
      <Suspense fallback={<LoadingState label="Yükleniyor..." />}>{children}</Suspense>
    </div>
  )
}

export function TeacherStudentProgressPage() {
  const { studentTeacherId } = useParams()
  const student = useTeacherStudent(studentTeacherId)
  if (!student) return <LoadingState label="Gelişim analizi yükleniyor..." />
  const subject = student.subjectName || 'Bu ders'
  return (
    <FocusPageFrame studentTeacherId={studentTeacherId}>
      <StudentProgressView
        studentId={studentTeacherId}
        title={`${subject} Gelişim Analizi`}
        emptySubtitle={`${subject} için ilerleme burada görünecek.`}
        buildSubtitle={(subjectLabel) => `${student.studentFullName} · ${subjectLabel} için emek, doğruluk ve kaynak ilerlemesi.`}
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
    <FocusPageFrame studentTeacherId={studentTeacherId}>
      <div>
        <h1 className="text-2xl font-bold leading-tight text-panel-text sm:text-3xl">
          {student.subjectName ? `${student.subjectName} Sınav Sonuçları` : 'Sınav Sonuçları'}
        </h1>
        <p className="mt-1 text-base text-panel-text-muted">{student.studentFullName} · deneme, branş izleme ve etüt sonuçları</p>
      </div>
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
