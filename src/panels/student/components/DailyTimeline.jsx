import { getSortedTasks } from '../../../utils/taskSelectors'
import TaskCard from './TaskCard'

export default function DailyTimeline({ tasks, onStart, onComplete, onPartialComplete, onReschedule, onHelp }) {
  const sorted = getSortedTasks(tasks)

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold text-panel-text">Günlük Zaman Çizelgesi</h2>
      {sorted.map((task) => (
        <TaskCard
          key={task.id}
          task={task}
          onStart={onStart}
          onComplete={onComplete}
          onPartialComplete={onPartialComplete}
          onReschedule={onReschedule}
          onHelp={onHelp}
        />
      ))}
    </div>
  )
}
