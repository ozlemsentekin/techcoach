import {
  getWrongQuestionAnalysisPhotos,
  getWrongQuestionAnalysisPhotoRecords,
  getWrongQuestionPhoto,
} from '../../../services/wrongQuestionService'
import AnalysisPhotosPage from '../../shared/AnalysisPhotosPage'

export default function StudentAnalysisPhotosPage() {
  return (
    <AnalysisPhotosPage
      fetchItems={getWrongQuestionAnalysisPhotos}
      fetchPhotos={getWrongQuestionAnalysisPhotoRecords}
      fetchQuestionPhoto={getWrongQuestionPhoto}
      subtitle="Velinin eklediği hata analiz görsellerine buradan ulaşabilirsin."
    />
  )
}
