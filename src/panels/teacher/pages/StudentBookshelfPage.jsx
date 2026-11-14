import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import StudentResourceLibraryModal from '../components/StudentResourceLibraryModal'
import LoadingState from '../../shared/LoadingState'
import { useTeacherStudent } from '../../../hooks/useTeacherStudentFocus'

// Öğretmenin öğrenciye özel "<Ad> Kitaplık" sayfası (/teacher/students/:id/kitaplik): Öğrencilerim
// kartındaki "Kaynaklar" penceresinin sayfa hali — öğretmenin dersindeki kaynaklar, ilerleme/başarı,
// kaynağa tıklayınca içerik/test ayrıntısı, "Kütüphane" sekmesinden kaynak atama.
export default function TeacherStudentBookshelfPage() {
  const { studentTeacherId } = useParams()
  const student = useTeacherStudent(studentTeacherId)

  if (!student) {
    return <LoadingState label="Kaynaklar yükleniyor..." />
  }

  return (
    <div className="flex flex-col gap-4">
      <Link
        to={`/teacher/students/${studentTeacherId}`}
        className="inline-flex w-fit items-center gap-1 text-sm text-panel-text-muted hover:text-panel-text"
      >
        <ArrowLeft size={16} /> Öğrenci sayfası
      </Link>
      <StudentResourceLibraryModal
        asPage
        student={{ studentTeacherId, studentFullName: student.studentFullName }}
      />
    </div>
  )
}
