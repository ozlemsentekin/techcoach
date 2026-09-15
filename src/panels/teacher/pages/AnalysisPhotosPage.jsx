import {
  getTeacherWrongQuestionAnalysisPhotos,
  getTeacherWrongQuestionAnalysisPhotoRecords,
} from '../../../services/teacherService'
import AnalysisPhotosPage from '../../shared/AnalysisPhotosPage'

// Öğretmenin kendi kapsamındaki (dbo.StudentTeachers) TÜM aktif öğrenci/ders ilişkilerinde, veli
// tarafından eklenmiş Hata Analiz görsellerini tek listede toplar — "sadece kendi derslerinde"
// kısıtı zaten backend'de (teacher.js listTeacherWrongQuestionAnalysisPhotosHandler) sağlanıyor.
export default function TeacherAnalysisPhotosPage() {
  return (
    <AnalysisPhotosPage
      fetchItems={getTeacherWrongQuestionAnalysisPhotos}
      fetchPhotos={getTeacherWrongQuestionAnalysisPhotoRecords}
      showStudentColumn
      subtitle="Öğrencilerinin Hata Defteri'nde eklenen hata analiz görselleri (sadece kendi derslerin)."
    />
  )
}
