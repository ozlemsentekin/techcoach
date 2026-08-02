import { Fragment, useEffect, useRef, useState } from 'react'
import {
  ArrowRightLeft,
  BookOpen,
  Calculator,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock,
  Eye,
  FlaskConical,
  Info,
  ListChecks,
  NotebookPen,
  Pencil,
  Printer,
  Trash2,
} from 'lucide-react'
import { getPendingTasks, getSortedTasks } from '../../../utils/taskSelectors'
import TaskStatusBadge from '../../shared/TaskStatusBadge'

const SUBJECT_BADGES = {
  Türkçe: { icon: BookOpen, text: 'text-panel-slate', soft: 'bg-panel-slate-soft' },
  Matematik: { icon: Calculator, text: 'text-panel-warm', soft: 'bg-panel-warm-soft' },
  'Fen Bilimleri': { icon: FlaskConical, text: 'text-panel-sage', soft: 'bg-panel-sage-soft' },
}
const DEFAULT_SUBJECT_BADGE = { icon: BookOpen, text: 'text-panel-blue', soft: 'bg-panel-blue-soft' }

function getSubjectBadge(task) {
  if (task.subject && SUBJECT_BADGES[task.subject]) return SUBJECT_BADGES[task.subject]
  const title = task.title || ''
  const inferredSubject = Object.keys(SUBJECT_BADGES).find((subject) => title.includes(subject))
  return inferredSubject ? SUBJECT_BADGES[inferredSubject] : DEFAULT_SUBJECT_BADGE
}

function formatRemainingDuration(minutes) {
  if (!minutes) return '0dk'
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours === 0) return `${mins}dk`
  if (mins === 0) return `${hours}sa`
  return `${hours}sa ${mins}dk`
}

function StatCard({ icon, label, value }) {
  const Icon = icon
  return (
    <div className="flex w-[168px] shrink-0 items-center gap-3 rounded-2xl border border-panel-border bg-white px-4 py-3 shadow-[0_1px_4px_rgba(20,25,40,0.04)]">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-panel-blue-soft text-panel-blue">
        <Icon size={18} aria-hidden="true" />
      </span>
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-xs text-panel-text-muted">{label}</span>
        <span className="truncate text-lg font-bold text-panel-text">{value}</span>
      </div>
    </div>
  )
}

function TimeChip({ task }) {
  const completed = task.status === 'tamamlandi'
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${
        completed ? 'bg-panel-sage-soft text-panel-sage' : 'bg-panel-surface-soft text-panel-text-muted'
      }`}
    >
      <Clock size={12} className="shrink-0" aria-hidden="true" />
      {task.startTime} – {task.endTime}
    </span>
  )
}

function SubjectBadge({ task }) {
  const { icon: Icon, text, soft } = getSubjectBadge(task)
  return (
    <span className={`inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${text} ${soft}`}>
      <Icon size={13} className="shrink-0" aria-hidden="true" />
      <span className="truncate">{task.title}</span>
    </span>
  )
}

function TaskDetail({ task }) {
  if (!task.description) {
    return <span className="text-sm text-panel-text-muted">—</span>
  }
  const lines = task.description
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  const visible = lines.slice(0, 3)
  const truncated = lines.length > 3

  return (
    <div className="max-w-[320px]" title={task.description}>
      {visible.map((line, index) => (
        <p
          key={index}
          className={`truncate text-sm ${index === 0 ? 'font-semibold text-panel-text' : 'text-panel-text-muted'}`}
        >
          {line}
          {truncated && index === visible.length - 1 ? '…' : ''}
        </p>
      ))}
    </div>
  )
}

const ACTION_BUTTON_CLASS =
  'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[10px] border border-panel-blue/30 bg-white px-3 text-sm font-medium text-panel-blue transition-colors hover:bg-panel-blue-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-panel-blue active:bg-panel-blue-soft'

function TaskActionsMenu({ isOpen, onToggle, onClose, onView, onEdit, onMove, onNote, onDelete }) {
  const containerRef = useRef(null)

  useEffect(() => {
    if (!isOpen) return undefined

    function handlePointerDown(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        onClose()
      }
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  const items = [
    { label: 'Görüntüle', icon: Eye, onClick: onView },
    { label: 'Düzenle', icon: Pencil, onClick: onEdit },
    { label: 'Taşı', icon: ArrowRightLeft, onClick: onMove },
    { label: 'Not Ekle', icon: NotebookPen, onClick: onNote },
    { label: 'Sil', icon: Trash2, onClick: onDelete, danger: true },
  ]

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      <button
        type="button"
        onClick={onToggle}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className={ACTION_BUTTON_CLASS}
      >
        İşlemler
        <ChevronDown size={14} className={`shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {isOpen ? (
        <div
          role="menu"
          className="absolute right-0 bottom-full z-20 mb-1.5 w-44 overflow-hidden rounded-xl border border-panel-border bg-white py-1 shadow-[0_10px_28px_rgba(37,30,60,0.14)]"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={() => {
                item.onClick()
                onClose()
              }}
              className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm focus-visible:outline-none focus-visible:bg-panel-surface-soft ${
                item.danger ? 'text-panel-red hover:bg-panel-red-soft' : 'text-panel-text hover:bg-panel-surface-soft'
              }`}
            >
              <item.icon size={14} className="shrink-0" aria-hidden="true" />
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export default function DailyPlanTable({ tasks, onEdit, onMove, onDelete, onSaveNote, onAddTask }) {
  const [expandedId, setExpandedId] = useState(null)
  const [openMenuId, setOpenMenuId] = useState(null)
  const [noteDraftId, setNoteDraftId] = useState(null)
  const [noteText, setNoteText] = useState('')

  const sorted = getSortedTasks(tasks)
  const completedCount = sorted.filter((task) => task.status === 'tamamlandi').length
  const remainingMinutes = getPendingTasks(tasks).reduce((sum, task) => sum + (task.durationMinutes || 0), 0)

  const startNoteDraft = (task) => {
    setNoteDraftId(task.id)
    setNoteText(task.notes || '')
  }

  const saveNote = (task) => {
    onSaveNote(task, noteText)
    setNoteDraftId(null)
  }

  return (
    <div className="rounded-2xl border border-panel-border bg-white shadow-[0_4px_16px_rgba(37,61,62,0.06)]">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-panel-border p-5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-panel-blue-soft text-panel-blue">
            <CalendarDays size={18} aria-hidden="true" />
          </span>
          <h2 className="text-xl font-bold text-panel-text">Bugünün Planı</h2>
        </div>

        <div className="flex flex-1 flex-wrap items-center justify-end gap-3">
          <StatCard icon={ListChecks} label="Toplam Görev" value={sorted.length} />
          <StatCard icon={CheckCircle2} label="Tamamlanan" value={completedCount} />
          <StatCard icon={Clock} label="Kalan Süre" value={formatRemainingDuration(remainingMinutes)} />

          <button
            type="button"
            onClick={onAddTask}
            className="h-10 shrink-0 rounded-[10px] bg-panel-blue px-4 text-sm font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-panel-blue active:opacity-90"
          >
            + Görev Ekle
          </button>
        </div>
      </div>

      {sorted.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-panel-text-muted">Bugün için planlanmış görev yok.</p>
      ) : (
        <>
          <div className="hidden md:block">
            <table className="w-full table-fixed text-left text-sm">
              <colgroup>
                <col className="w-[130px]" />
                <col className="w-[190px]" />
                <col className="w-[150px]" />
                <col />
                <col className="w-[130px]" />
              </colgroup>
              <thead>
                <tr className="bg-panel-blue-soft text-[13px] font-semibold text-panel-blue">
                  <th className="py-2.5 pl-5 pr-3">Saat</th>
                  <th className="py-2.5 pr-3">Görev</th>
                  <th className="py-2.5 pr-3">Durum</th>
                  <th className="py-2.5 pr-3">Görev Detayı</th>
                  <th className="py-2.5 pr-5">İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((task) => (
                  <Fragment key={task.id}>
                    <tr className="border-b border-panel-border last:border-0 hover:bg-panel-surface-soft">
                      <td className="py-3 pl-5 pr-3 align-top">
                        <TimeChip task={task} />
                      </td>
                      <td className="py-3 pr-3 align-top">
                        <SubjectBadge task={task} />
                      </td>
                      <td className="py-3 pr-3 align-top">
                        <TaskStatusBadge status={task.status} />
                      </td>
                      <td className="py-3 pr-3 align-top">
                        <TaskDetail task={task} />
                      </td>
                      <td className="py-3 pr-5 align-top">
                        <TaskActionsMenu
                          isOpen={openMenuId === task.id}
                          onToggle={() => setOpenMenuId(openMenuId === task.id ? null : task.id)}
                          onClose={() => setOpenMenuId(null)}
                          onView={() => setExpandedId(expandedId === task.id ? null : task.id)}
                          onEdit={() => onEdit(task)}
                          onMove={() => onMove(task)}
                          onNote={() => startNoteDraft(task)}
                          onDelete={() => onDelete(task)}
                        />
                      </td>
                    </tr>
                    {expandedId === task.id ? (
                      <tr className="border-b border-panel-border bg-panel-surface-soft">
                        <td colSpan={5} className="px-5 py-3 text-sm text-panel-text-muted">
                          {task.description || 'Açıklama eklenmemiş.'}
                          {task.notes ? <p className="mt-1 text-panel-text">Not: {task.notes}</p> : null}
                        </td>
                      </tr>
                    ) : null}
                    {noteDraftId === task.id ? (
                      <tr className="border-b border-panel-border">
                        <td colSpan={5} className="px-5 py-3">
                          <div className="flex gap-2">
                            <input
                              value={noteText}
                              onChange={(event) => setNoteText(event.target.value)}
                              className="flex-1 rounded-xl border border-panel-border p-2 text-sm text-panel-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-panel-blue"
                              placeholder="Bu görevle ilgili bir not yaz"
                            />
                            <button
                              type="button"
                              onClick={() => saveNote(task)}
                              className="rounded-[10px] bg-panel-blue px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
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

          <div className="flex flex-col gap-3 p-4 md:hidden">
            {sorted.map((task) => (
              <div key={task.id} className="rounded-2xl border border-panel-border bg-white p-3.5 shadow-[0_1px_4px_rgba(20,25,40,0.04)]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <TimeChip task={task} />
                  <TaskStatusBadge status={task.status} />
                </div>
                <div className="mt-2.5">
                  <SubjectBadge task={task} />
                </div>
                <div className="mt-2.5">
                  <TaskDetail task={task} />
                </div>
                {expandedId === task.id ? (
                  <div className="mt-2.5 rounded-xl bg-panel-surface-soft p-2.5 text-sm text-panel-text-muted">
                    {task.description || 'Açıklama eklenmemiş.'}
                    {task.notes ? <p className="mt-1 text-panel-text">Not: {task.notes}</p> : null}
                  </div>
                ) : null}
                {noteDraftId === task.id ? (
                  <div className="mt-2.5 flex gap-2">
                    <input
                      value={noteText}
                      onChange={(event) => setNoteText(event.target.value)}
                      className="flex-1 rounded-xl border border-panel-border p-2 text-sm text-panel-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-panel-blue"
                      placeholder="Bu görevle ilgili bir not yaz"
                    />
                    <button
                      type="button"
                      onClick={() => saveNote(task)}
                      className="rounded-[10px] bg-panel-blue px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
                    >
                      Kaydet
                    </button>
                  </div>
                ) : null}
                <div className="mt-3 flex justify-end">
                  <TaskActionsMenu
                    isOpen={openMenuId === task.id}
                    onToggle={() => setOpenMenuId(openMenuId === task.id ? null : task.id)}
                    onClose={() => setOpenMenuId(null)}
                    onView={() => setExpandedId(expandedId === task.id ? null : task.id)}
                    onEdit={() => onEdit(task)}
                    onMove={() => onMove(task)}
                    onNote={() => startNoteDraft(task)}
                    onDelete={() => onDelete(task)}
                  />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-panel-border px-5 py-3.5">
        <p className="flex items-center gap-1.5 text-xs text-panel-text-muted">
          <Info size={13} className="shrink-0" aria-hidden="true" />
          <span>
            <span className="font-medium text-panel-text">İpucu:</span> Görevleri tamamladıkça plan otomatik güncellenir.
          </span>
        </p>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[10px] border border-panel-blue/30 bg-white px-3.5 text-sm font-medium text-panel-blue transition-colors hover:bg-panel-blue-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-panel-blue active:bg-panel-blue-soft"
        >
          <Printer size={14} className="shrink-0" aria-hidden="true" />
          Planı Yazdır
        </button>
      </div>
    </div>
  )
}
