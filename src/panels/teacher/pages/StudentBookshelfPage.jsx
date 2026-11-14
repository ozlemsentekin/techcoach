import { useParams } from 'react-router-dom'
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
      <StudentResourceLibraryModal
        asPage
        student={{ studentTeacherId, studentFullName: student.studentFullName }}
      />
    </div>
  )
}
