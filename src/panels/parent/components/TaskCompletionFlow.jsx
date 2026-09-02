import { patchTask } from '../../../services/taskService'
import { buildCompletionUpdates, resolveCompletionFlow } from '../../shared/taskCompletion'
import TaskAnswerSheetModal from '../../student/components/TaskAnswerSheetModal'
import QuestionCountModal from '../../student/components/QuestionCountModal'
import ReadingProgressModal from '../../student/components/ReadingProgressModal'

// Veli, çocuğun bekleyen görevini "Tamamla" dediğinde açılan akış — öğrencinin kendi
// akışının aynısı: soru bankası + cevap anahtarı → optik cevap kağıdı (yanlışlarda hata
// fotoğrafı), anahtarsız → soru sayısı, okuma kitabı → sayfa girişi.
// 'direct' tipli görevler modal açmaz; çağıran taraf completeTaskDirect ile halleder.
export default function TaskCompletionFlow({ task, studentId, onClose, onCompleted }) {
  if (!task) return null

  const flow = resolveCompletionFlow(task)

  if (flow === 'answer_sheet') {
    return (
      <TaskAnswerSheetModal
        task={task}
        lessonLabel={task.subject || 'Görev'}
        photoMode="edit"
        studentId={studentId}
        onClose={onClose}
        onSaved={(updatedTask) => onCompleted?.(updatedTask)}
      />
    )
  }

  if (flow === 'question_count') {
    return (
      <QuestionCountModal
        task={task}
        onClose={onClose}
        onSave={async (payload) => {
          const updated = await patchTask(
            task.id,
            buildCompletionUpdates(task, {
              completedQuestionCount: payload.completedQuestionCount,
              status: payload.status,
            }),
            studentId,
          )
          onCompleted?.(updated)
        }}
      />
    )
  }

  if (flow === 'reading') {
    return (
      <ReadingProgressModal
        task={task}
        onClose={onClose}
        onSave={async (payload) => {
          const updated = await patchTask(
            task.id,
            buildCompletionUpdates(task, {
              completedPageCount: payload.completedPageCount,
              currentPageNumber: payload.currentPageNumber,
              status: payload.status,
            }),
            studentId,
          )
          onCompleted?.(updated)
        }}
      />
    )
  }

  return null
}
