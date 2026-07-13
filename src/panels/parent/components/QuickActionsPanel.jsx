import { CalendarRange, NotebookPen, FileCheck2, Coffee, Sun } from 'lucide-react'

export default function QuickActionsPanel({ onPlanWeek, onAddHomework, onAddTest, onAddBreak, onAddFreeTime }) {
  const actions = [
    { label: 'Haftayı Planla', icon: CalendarRange, onClick: onPlanWeek },
    { label: 'Ödev Ekle', icon: NotebookPen, onClick: onAddHomework },
    { label: 'Test Ekle', icon: FileCheck2, onClick: onAddTest },
    { label: 'Mola Ekle', icon: Coffee, onClick: onAddBreak },
  ]

  return (
    <div className="rounded-2xl border border-panel-border bg-panel-surface p-5">
      <h2 className="text-base font-semibold text-panel-text">Hızlı İşlemler</h2>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={action.onClick}
            className="flex flex-col items-center gap-1.5 rounded-xl border border-panel-border p-3 text-center text-sm font-medium text-panel-text hover:bg-panel-bg"
          >
            <action.icon size={18} aria-hidden="true" />
            {action.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onAddFreeTime}
        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-panel-border p-3 text-sm font-medium text-panel-text hover:bg-panel-bg"
      >
        <Sun size={18} aria-hidden="true" />
        Serbest Zaman Ekle
      </button>
    </div>
  )
}
