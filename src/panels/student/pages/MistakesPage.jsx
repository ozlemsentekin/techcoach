import {
  getWrongQuestions,
  getWrongQuestionTopicStats,
  getWrongQuestionPhoto,
  updateWrongQuestion,
} from '../../../services/wrongQuestionService'
import WrongQuestionsView from '../../shared/WrongQuestionsView'

export default function MistakesPage() {
  return (
    <WrongQuestionsView
      fetchWrongQuestions={getWrongQuestions}
      fetchTopicStats={getWrongQuestionTopicStats}
      fetchPhoto={getWrongQuestionPhoto}
      updateMistakeReason={(id, mistakeReason) => updateWrongQuestion(id, { mistakeReason })}
    />
  )
}
