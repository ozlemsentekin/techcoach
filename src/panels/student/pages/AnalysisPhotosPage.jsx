import { getWrongQuestionAnalysisPhotos, getWrongQuestionAnalysisPhoto } from '../../../services/wrongQuestionService'
import AnalysisPhotosPage from '../../shared/AnalysisPhotosPage'

export default function StudentAnalysisPhotosPage() {
  return (
    <AnalysisPhotosPage
      fetchItems={getWrongQuestionAnalysisPhotos}
      fetchPhoto={getWrongQuestionAnalysisPhoto}
      subtitle="Velinin eklediği hata analiz görsellerine buradan ulaşabilirsin."
    />
  )
}
