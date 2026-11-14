import { useMemo } from 'react'
import {
  createTeacherMistakeAnalysis,
  deleteTeacherMistakeAnalysis,
  getTeacherMistakeAnalysisSession,
  updateTeacherMistakeAnalysis,
  updateTeacherStudentWrongQuestionPhoto,
} from '../../services/teacherService'

// Öğretmen için MistakeAnalysisBoard veri işlemleri (studentTeacherId bağlamında, öğretmenin dersi).
export function useTeacherMistakeBoardApi(studentTeacherId) {
  return useMemo(
    () => ({
      load: () => getTeacherMistakeAnalysisSession(studentTeacherId),
      create: (itemId, payload) => createTeacherMistakeAnalysis(studentTeacherId, itemId, payload),
      update: (itemId, analysisId, payload) => updateTeacherMistakeAnalysis(studentTeacherId, itemId, analysisId, payload),
      remove: (itemId, analysisId) => deleteTeacherMistakeAnalysis(studentTeacherId, itemId, analysisId),
      savePhoto: (itemId, dataUrl) => updateTeacherStudentWrongQuestionPhoto(studentTeacherId, itemId, dataUrl),
    }),
    [studentTeacherId],
  )
}

