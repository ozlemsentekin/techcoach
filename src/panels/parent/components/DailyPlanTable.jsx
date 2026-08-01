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
    <div className="overflow-hidden rounded-2xl border border-[#e4e8e9] bg-white p-5 shadow-[0_4px_16px_rgba(37,61,62,0.06)]">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-[#253d3e]">Bugünün Planı</h2>
        <span className="text-sm text-[#667475]">Toplam {sorted.length} görev</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead>
            <tr className="bg-[#f8f7fb] text-[13px] font-semibold text-[#655e94]">
              <th className="py-2 pl-3 pr-3">Saat</th>
              <th className="py-2 pr-3">Görev</th>
              <th className="py-2 pr-3">Durum</th>
              <th className="py-2 pr-3">İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((task) => (
              <Fragment key={task.id}>
                <tr className="border-b border-[#edf0f1] last:border-0 hover:bg-[#f8f7fb]">
                  <td className="py-2.5 pl-3 pr-3 text-[#667475]">
                    {task.startTime} – {task.endTime}
                  </td>
                  <td className="py-2.5 pr-3 text-[#253d3e]">{task.title}</td>
                  <td className="py-2.5 pr-3">
                    <TaskStatusBadge status={task.status} />
                  </td>
                  <td className="py-2.5 pr-3">
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => onEdit(task)} className="text-[#655e94] hover:underline">
                        Düzenle
                      </button>
                      <button
                        type="button"
                        onClick={() => setExpandedId(expandedId === task.id ? null : task.id)}
                        className="text-[#655e94] hover:underline"
                      >
                        Detay
                      </button>
                      <button type="button" onClick={() => onMove(task)} className="text-[#655e94] hover:underline">
                        Taşı
                      </button>
                      <button
                        type="button"
                        onClick={() => startNoteDraft(task)}
                        className="text-[#655e94] hover:underline"
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
                  <tr key={`${task.id}-detail`} className="border-b border-[#edf0f1] bg-[#f8f7fb]">
                    <td colSpan={4} className="px-3 py-3 text-sm text-[#667475]">
                      {task.description || 'Açıklama eklenmemiş.'}
                      {task.notes ? <p className="mt-1 text-[#253d3e]">Not: {task.notes}</p> : null}
                    </td>
                  </tr>
                ) : null}
                {noteDraftId === task.id ? (
                  <tr key={`${task.id}-note`} className="border-b border-[#edf0f1]">
                    <td colSpan={4} className="px-3 py-3">
                      <div className="flex gap-2">
                        <input
                          value={noteText}
                          onChange={(event) => setNoteText(event.target.value)}
                          className="flex-1 rounded-xl border border-[#dfe4e5] p-2 text-sm text-[#253d3e]"
                          placeholder="Bu görevle ilgili bir not yaz"
                        />
                        <button
                          type="button"
                          onClick={() => saveNote(task)}
                          className="rounded-[10px] bg-[#655e94] px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
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
