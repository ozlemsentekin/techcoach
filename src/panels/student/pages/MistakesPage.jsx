import {
  getWrongQuestions,
  getWrongQuestionTopicStats,
  getWrongQuestionPhoto,
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
      updateMistakeReason={(id, mistakeReason) => updateWrongQuestion(id, { mistakeReason })}
      updateMistakeMeta={(id, updates) => updateWrongQuestion(id, updates)}
      updateMistakePhoto={(id, dataUrl) => updateWrongQuestionPhoto(id, dataUrl)}
    />
  )
}
