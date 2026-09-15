import {
  getWrongQuestions,
  getWrongQuestionTopicStats,
  getWrongQuestionPhoto,
  getWrongQuestionAnalysisPhoto,
  updateWrongQuestion,
  updateWrongQuestionPhoto,
} from '../../../services/wrongQuestionService'
import WrongQuestionsView from '../../shared/WrongQuestionsView'

export default function MistakesPage() {
  return (
    <WrongQuestionsView
      fetchWrongQuestions={getWrongQuestions}
      fetchTopicStats={getWrongQuestionTopicStats}
      fetchPhoto={getWrongQuestionPhoto}
      fetchAnalysisPhoto={getWrongQuestionAnalysisPhoto}
      viewerRole="ogrenci"
      updateMistakeAnalysis={(id, analysis) => updateWrongQuestion(id, { analysis })}
      updateMistakeMeta={(id, updates) => updateWrongQuestion(id, updates)}
      updateMistakePhoto={(id, dataUrl) => updateWrongQuestionPhoto(id, dataUrl)}
    />
  )
}
