import MockExamsView from '../../shared/MockExamsView'
import {
  getMockExams,
  getMockExam,
  getMockExamPhoto,
  createMockExam,
  updateMockExam,
  updateMockExamExperience,
  deleteMockExam,
  addMockExamPhoto,
  addMockExamQuestionPhoto,
  deleteMockExamPhoto,
  getMockExamTopicSuggestions,
  getMockExamTopicStats,
  getMockExamGrowthSummary,
} from '../../../services/mockExamService'

export default function MockExamsPage() {
  return (
    <MockExamsView
      canEditExperience
      fetchMockExams={getMockExams}
      fetchMockExam={getMockExam}
      fetchPhoto={getMockExamPhoto}
      createMockExam={createMockExam}
      updateMockExam={updateMockExam}
      updateExperience={updateMockExamExperience}
      deleteMockExam={deleteMockExam}
      addPhoto={addMockExamPhoto}
      addQuestionPhoto={addMockExamQuestionPhoto}
      deletePhoto={deleteMockExamPhoto}
      fetchTopicSuggestions={getMockExamTopicSuggestions}
      fetchTopicStats={getMockExamTopicStats}
      fetchGrowthSummary={getMockExamGrowthSummary}
    />
  )
}
