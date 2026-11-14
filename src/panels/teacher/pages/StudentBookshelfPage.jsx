import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import BookshelfPage from '../../shared/bookshelf/BookshelfPage'
import LoadingState from '../../shared/LoadingState'
import { studentFirstName, useTeacherStudent } from '../../../hooks/useTeacherStudentFocus'

// Öğretmenin öğrenciye özel Kitaplık görünümü (/teacher/students/:id/kitaplik): ortak Kitaplık
// sayfası, yalnızca o öğrenciye atanmış kaynaklarla.
export default function TeacherStudentBookshelfPage() {
  const { studentTeacherId } = useParams()
  const student = useTeacherStudent(studentTeacherId)

  if (!student) {
    return <LoadingState label="Kitaplık yükleniyor..." />
  }

  return (
    <div className="flex flex-col gap-4">
      <Link
        to={`/teacher/students/${studentTeacherId}`}
        className="inline-flex w-fit items-center gap-1 text-sm text-panel-text-muted hover:text-panel-text"
      >
        <ArrowLeft size={16} /> Öğrenci sayfası
      </Link>
      <BookshelfPage
        showAssignees
        studentId={student.studentId}
        title={`${studentFirstName(student)} Kitaplık`}
        subtitle={`${student.studentFullName} ile takip ettiğiniz kaynaklar.`}
      />
    </div>
  )
}
