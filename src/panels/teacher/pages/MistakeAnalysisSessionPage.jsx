import { useParams } from 'react-router-dom'
import MistakeAnalysisBoard from '../../shared/MistakeAnalysisBoard'
import { useTeacherMistakeBoardApi } from '../useTeacherMistakeBoardApi'

// Öğretmenin öğrenciye özel "Çeyrek Dönem Analizi" Hata Defteri sayfası
// (/teacher/students/:id/hata-analizi) — görünüm ortak MistakeAnalysisBoard'da.
export default function MistakeAnalysisSessionPage() {
  const { studentTeacherId } = useParams()
  const api = useTeacherMistakeBoardApi(studentTeacherId)
  return <MistakeAnalysisBoard api={api} />
}
