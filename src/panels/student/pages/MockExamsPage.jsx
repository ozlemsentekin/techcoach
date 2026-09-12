import MockExamsView from '../../shared/MockExamsView'
import {
  getMockExams,
  getMockExam,
  getMockExamPhoto,
  createMockExam,
  updateMockExam,
  deleteMockExam,
  addMockExamPhoto,
  addMockExamQuestionPhoto,
  deleteMockExamPhoto,
  getMockExamTopicSuggestions,
  getMockExamTopicStats,
} from '../../../services/mockExamService'

export default function MockExamsPage() {
  return (
    <MockExamsView
      fetchMockExams={getMockExams}
      fetchMockExam={getMockExam}
      fetchPhoto={getMockExamPhoto}
      createMockExam={createMockExam}
      updateMockExam={updateMockExam}
      deleteMockExam={deleteMockExam}
      addPhoto={addMockExamPhoto}
      addQuestionPhoto={addMockExamQuestionPhoto}
      deletePhoto={deleteMockExamPhoto}
      fetchTopicSuggestions={getMockExamTopicSuggestions}
      fetchTopicStats={getMockExamTopicStats}
    />
  )
}
