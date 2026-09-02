// Görev tamamlama akışında öğrenci ve veli panelleri arasında paylaşılan yardımcılar.
import { patchTask } from '../../services/taskService'

export const TIMER_STOP_STATUSES = new Set(['tamamlandi', 'kismen-tamamlandi'])

export function buildTimerStopUpdates(task, stoppedAt) {
  if (!task?.timerStartedAt || task.timerStoppedAt) return {}

  const startedMs = new Date(task.timerStartedAt).getTime()
  const stoppedMs = new Date(stoppedAt).getTime()
  const updates = { timerStoppedAt: stoppedAt }

  if (Number.isFinite(startedMs) && Number.isFinite(stoppedMs)) {
    updates.timerElapsedSeconds = Math.max(0, Math.round((stoppedMs - startedMs) / 1000))
  }

  return updates
}

export function buildCompletionUpdates(task, updates) {
  const completedAt = updates.completedAt || new Date().toISOString()
  const shouldStopTimer = TIMER_STOP_STATUSES.has(updates.status)

  return {
    ...updates,
    completedAt,
    ...(shouldStopTimer ? buildTimerStopUpdates(task, completedAt) : {}),
  }
}

// Bir görev "Tamamla" denince hangi ekranı açmalı?
//  - 'answer_sheet'   : soru bankası + cevap anahtarı → optik cevap kağıdı
//  - 'question_count' : soru bankası, cevap anahtarı yok → doğru/yanlış/boş sayısı
//  - 'reading'        : okuma kitabı → sayfa ilerlemesi
//  - 'direct'         : diğer görevler → doğrudan tamamlandı
// (Öğrenci panelindeki TaskListSection.openTask mantığıyla birebir.)
export function resolveCompletionFlow(task) {
  if (task?.resourceType === 'soru_bankasi' && Boolean(task?.selectedTestIds?.length)) {
    return task?.hasAnswerKey === false ? 'question_count' : 'answer_sheet'
  }
  if (task?.resourceType === 'okuma_kitabi') return 'reading'
  return 'direct'
}

// 'direct' tipli görevi (mola, spor, serbest zaman, konu çalışması...) tek adımda tamamlar.
export function completeTaskDirect(task, studentId) {
  return patchTask(task.id, buildCompletionUpdates(task, { status: 'tamamlandi' }), studentId)
}
