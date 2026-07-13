import { Fragment, useState } from 'react'
import { getSortedTasks } from '../../../utils/taskSelectors'
import TaskStatusBadge from '../../shared/TaskStatusBadge'

export default function DailyPlanTable({ tasks, onEdit, onMove, onDelete, onSaveNote }) {
  const [expandedId, setExpandedId] = useState(null)
  const [noteDraftId, setNoteDraftId] = useState(null)
  const [noteText, setNoteText] = useState('')

  const sorted = getSortedTasks(tasks)

  const startNoteDraft = (task) => {
    setNoteDraftId(task.id)
    setNoteText(task.notes || '')
  }

  const saveNote = (task) => {
    onSaveNote(task, noteText)
    setNoteDraftId(null)
  }

  return (
    <div className="rounded-2xl border border-panel-border bg-panel-surface p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-panel-text">Bugünün Planı</h2>
        <span className="text-sm text-panel-text-muted">Toplam {sorted.length} görev</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead>
            <tr className="border-b border-panel-border text-panel-text-muted">
              <th className="py-2 pr-3 font-medium">Saat</th>
              <th className="py-2 pr-3 font-medium">Görev</th>
              <th className="py-2 pr-3 font-medium">Durum</th>
              <th className="py-2 font-medium">İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((task) => (
              <Fragment key={task.id}>
                <tr className="border-b border-panel-border last:border-0">
                  <td className="py-2.5 pr-3 text-panel-text-muted">
                    {task.startTime} – {task.endTime}
                  </td>
                  <td className="py-2.5 pr-3 text-panel-text">{task.title}</td>
                  <td className="py-2.5 pr-3">
                    <TaskStatusBadge status={task.status} />
                  </td>
                  <td className="py-2.5">
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => onEdit(task)} className="text-panel-blue hover:underline">
                        Düzenle
                      </button>
                      <button
                        type="button"
                        onClick={() => setExpandedId(expandedId === task.id ? null : task.id)}
                        className="text-panel-blue hover:underline"
                      >
                        Detay
                      </button>
                      <button type="button" onClick={() => onMove(task)} className="text-panel-blue hover:underline">
                        Taşı
                      </button>
                      <button
                        type="button"
                        onClick={() => startNoteDraft(task)}
                        className="text-panel-blue hover:underline"
                      >
                        Not ekle
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(task)}
                        className="text-panel-warm hover:underline"
                      >
                        Sil
                      </button>
                    </div>
                  </td>
                </tr>
                {expandedId === task.id ? (
                  <tr key={`${task.id}-detail`} className="border-b border-panel-border bg-panel-surface-soft">
                    <td colSpan={4} className="px-2 py-3 text-sm text-panel-text-muted">
                      {task.description || 'Açıklama eklenmemiş.'}
                      {task.notes ? <p className="mt-1 text-panel-text">Not: {task.notes}</p> : null}
                    </td>
                  </tr>
                ) : null}
                {noteDraftId === task.id ? (
                  <tr key={`${task.id}-note`} className="border-b border-panel-border">
                    <td colSpan={4} className="px-2 py-3">
                      <div className="flex gap-2">
                        <input
                          value={noteText}
                          onChange={(event) => setNoteText(event.target.value)}
                          className="flex-1 rounded-xl border border-panel-border p-2 text-sm text-panel-text"
                          placeholder="Bu görevle ilgili bir not yaz"
                        />
                        <button
                          type="button"
                          onClick={() => saveNote(task)}
                          className="rounded-xl bg-panel-blue px-3 py-2 text-sm font-semibold text-white"
                        >
                          Kaydet
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
