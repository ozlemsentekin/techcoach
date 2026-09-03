import { nowMinutes, parseTimeToMinutes, todayISODate } from './time'

/**
 * Görev bir "özel ders" mi? Şunları kapsar:
 *  - veli tarafından eklenen "Özel Ders" görevi (taskType === 'ozel-ders')
 *  - öğretmenin eklediği ders görevi (ders-calisma + student_teacher_id)
 *  - haftalık plandaki tekrarlayan ders slotu (isScheduleSlot)
 *  - "Bugün" akışına düşen tekrarlayan ders öğesi (isTeacherLessonSlot)
 */
export function isPrivateLessonTask(task) {
  if (!task) return false
  if (task.isTeacherLessonSlot || task.isScheduleSlot) return true
  if (task.taskType === 'ozel-ders') return true
  if (task.taskType === 'ders-calisma' && task.studentTeacherId) return true
  return false
}

/**
 * Bugüne planlanmış bir özel dersin bitiş saati geçtiyse true döner. Böyle bir ders "Bugün"
 * akışından (veli / öğretmen / öğrenci) otomatik düşer — kimsenin "Tamamla"ya basması gerekmez.
 */
export function isEndedPrivateLessonForToday(task, referenceDateISO = todayISODate()) {
  if (!isPrivateLessonTask(task) || !task.endTime) return false
  if (task.date !== referenceDateISO) return false
  return nowMinutes() >= parseTimeToMinutes(task.endTime)
}
