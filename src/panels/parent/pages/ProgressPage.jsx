import { useMemo } from 'react'
import { Flame, CalendarCheck, BookOpenCheck } from 'lucide-react'
import { getSessions } from '../../../services/studySessionService'
import { getTasksForDate } from '../../../services/taskService'
import { getWrongQuestions } from '../../../services/wrongQuestionService'
import { todayISODate } from '../../../utils/time'
import PageHeader from '../../layout/PageHeader'
import ProgressSummaryCard from '../../shared/ProgressSummaryCard'

export default function ProgressPage() {
  const stats = useMemo(() => {
    const sessions = getSessions()
    const focusMinutes = sessions.reduce((sum, session) => sum + (session.durationMinutes || 0), 0)

    const tasks = getTasksForDate(todayISODate())
    const startedPlan = tasks.some((task) => task.status !== 'bekliyor')
    const completedCount = tasks.filter((task) => ['tamamlandi', 'kismen-tamamlandi'].includes(task.status)).length

    const learnedMistakes = getWrongQuestions().filter((item) => item.reviewStatus === 'ogrenildi').length

    return { focusMinutes, startedPlan, completedCount, totalTasks: tasks.length, learnedMistakes }
  }, [])

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <PageHeader title="Gelişim" subtitle="Aylin'in emeği, istikrarı ve öğrenmesi burada görünüyor." />

      <div className="grid gap-3 sm:grid-cols-3">
        <ProgressSummaryCard
          icon={Flame}
          title="Emek"
          value={`${stats.focusMinutes} dk`}
          description="Toplam odaklı çalışma süresi"
        />
        <ProgressSummaryCard
          icon={CalendarCheck}
          title="İstikrar"
          value={`${stats.completedCount} / ${stats.totalTasks}`}
          description={stats.startedPlan ? 'Bugün planına başladı' : 'Bugün henüz başlamadı'}
        />
        <ProgressSummaryCard
          icon={BookOpenCheck}
          title="Öğrenme"
          value={stats.learnedMistakes}
          description="Öğrenilmiş duruma getirilen yanlış"
        />
      </div>

      <div className="rounded-2xl border border-panel-border bg-panel-surface p-5">
        <p className="text-sm text-panel-text-muted">
          Daha derin haftalık/aylık gelişim grafikleri, birden fazla günün verisi biriktikçe bir sonraki
          geliştirme aşamasında eklenecek.
        </p>
      </div>
    </div>
  )
}
