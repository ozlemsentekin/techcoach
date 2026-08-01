import { useEffect, useState } from 'react'
import { Flame, CalendarCheck, BookOpenCheck } from 'lucide-react'
import { getSessions } from '../../../services/studySessionService'
import { getTasksForDate } from '../../../services/taskService'
import { getWrongQuestions } from '../../../services/wrongQuestionService'
import { todayISODate } from '../../../utils/time'
import PageHeader from '../../layout/PageHeader'
import LoadingState from '../../shared/LoadingState'
import ProgressSummaryCard from '../../shared/ProgressSummaryCard'

export default function ProgressPage() {
  const [stats, setStats] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let ignore = false

    Promise.all([getTasksForDate(todayISODate()), getSessions(), getWrongQuestions()])
      .then(([tasks, sessions, wrongQuestions]) => {
        if (ignore) return
        const focusMinutes = sessions.reduce((sum, session) => sum + (session.durationMinutes || 0), 0)
        const startedPlan = tasks.some((task) => task.status !== 'bekliyor')
        const completedCount = tasks.filter((task) => ['tamamlandi', 'kismen-tamamlandi'].includes(task.status)).length
        const learnedMistakes = wrongQuestions.filter((item) => item.reviewStatus === 'ogrenildi').length
        setStats({ focusMinutes, startedPlan, completedCount, totalTasks: tasks.length, learnedMistakes })
      })
      .catch((err) => {
        if (!ignore) setError(err.message)
      })

    return () => {
      ignore = true
    }
  }, [])

  if (error) {
    return <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-base text-panel-warm">{error}</div>
  }

  if (stats === null) {
    return <LoadingState label="Gelişim verileri yükleniyor..." />
  }

  return (
    <div className="flex w-full flex-col gap-5">
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

      <div className="panel-card p-5">
        <p className="text-sm text-panel-text-muted">
          Daha derin haftalık/aylık gelişim grafikleri, birden fazla günün verisi biriktikçe bir sonraki
          geliştirme aşamasında eklenecek.
        </p>
      </div>
    </div>
  )
}
