import { getWrongQuestionAnalysisPhotos, getWrongQuestionAnalysisPhotoRecords } from '../../../services/wrongQuestionService'
import AnalysisPhotosPage from '../../shared/AnalysisPhotosPage'

export default function StudentAnalysisPhotosPage() {
  return (
    <AnalysisPhotosPage
      fetchItems={getWrongQuestionAnalysisPhotos}
      fetchPhotos={getWrongQuestionAnalysisPhotoRecords}
      subtitle="Velinin eklediği hata analiz görsellerine buradan ulaşabilirsin."
    />
  )
}
