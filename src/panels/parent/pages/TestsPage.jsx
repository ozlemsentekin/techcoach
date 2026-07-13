import { useMemo } from 'react'
import { FileCheck2 } from 'lucide-react'
import { getSessions } from '../../../services/studySessionService'
import { getTasksForDate } from '../../../services/taskService'
import { calculateNet } from '../../../utils/netCalculator'
import { todayISODate } from '../../../utils/time'
import PageHeader from '../../layout/PageHeader'
import EmptyState from '../../shared/EmptyState'

export default function TestsPage() {
  const testSessions = useMemo(() => {
    const tasksById = Object.fromEntries(getTasksForDate(todayISODate()).map((task) => [task.id, task]))
    return getSessions()
      .filter((session) => session.correctCount !== undefined)
      .map((session) => ({ ...session, task: tasksById[session.taskId] }))
      .sort((a, b) => new Date(b.endedAt) - new Date(a.endedAt))
  }, [])

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <PageHeader title="Test ve Denemeler" subtitle="Aylin'in çözdüğü testlerin sonuçları." />

      {testSessions.length === 0 ? (
        <EmptyState icon={FileCheck2} title="Henüz test sonucu yok" description="Aylin bir test tamamladığında burada görünecek." />
      ) : (
        <div className="flex flex-col gap-3">
          {testSessions.map((session) => (
            <div key={session.id} className="rounded-2xl border border-panel-border bg-panel-surface p-5">
              <div className="flex items-center justify-between">
                <p className="text-base font-semibold text-panel-text">
                  {session.task?.subject || session.task?.title || 'Çalışma Oturumu'}
                </p>
                <p className="text-sm text-panel-text-muted">
                  {new Date(session.endedAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}
                </p>
              </div>
              <div className="mt-2 flex flex-wrap gap-3 text-sm text-panel-text-muted">
                <span>Doğru: {session.correctCount}</span>
                <span>Yanlış: {session.wrongCount}</span>
                <span>Boş: {session.blankCount}</span>
                <span className="font-medium text-panel-text">Net: {calculateNet(session.correctCount, session.wrongCount)}</span>
              </div>
              {session.difficultyRating ? (
                <p className="mt-1 text-sm text-panel-text-muted">Zorluk: {session.difficultyRating}</p>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
