import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowRightLeft,
  BookOpen,
  Calculator,
  CalendarDays,
  CheckCircle2,
  Clock,
  Eye,
  FlaskConical,
  MoreHorizontal,
  NotebookPen,
  Pencil,
  Plus,
  Printer,
  Trash2,
} from 'lucide-react'
import { getSortedTasks } from '../../../utils/taskSelectors'
import { parseTimeToMinutes } from '../../../utils/time'
import { STATUS_LABELS } from '../../../data/taskTypes'

const SUBJECT_BADGES = {
  Türkçe: { icon: BookOpen, text: 'text-panel-slate', soft: 'bg-panel-slate-soft', border: 'border-panel-slate/25' },
  Matematik: { icon: Calculator, text: 'text-panel-warm', soft: 'bg-panel-warm-soft', border: 'border-panel-warm/25' },
  'Fen Bilimleri': { icon: FlaskConical, text: 'text-panel-sage', soft: 'bg-panel-sage-soft', border: 'border-panel-sage/25' },
}
const DEFAULT_SUBJECT_BADGE = {
  icon: BookOpen,
  text: 'text-panel-blue',
  soft: 'bg-panel-blue-soft',
  border: 'border-panel-blue/25',
}

const STATUS_STYLES = {
  bekliyor: { icon: Clock, className: 'bg-panel-blue-soft text-panel-blue' },
  'devam-ediyor': { icon: Clock, className: 'bg-panel-warm-soft text-panel-warm' },
  tamamlandi: { icon: CheckCircle2, className: 'bg-panel-sage-soft text-panel-sage' },
  'kismen-tamamlandi': { icon: CheckCircle2, className: 'bg-panel-sage-soft text-panel-sage' },
  'yeniden-planlandi': { icon: ArrowRightLeft, className: 'bg-panel-lilac-soft text-panel-lilac' },
  'yardim-bekliyor': { icon: NotebookPen, className: 'bg-panel-warm-soft text-panel-warm' },
}

function getSubjectBadge(task) {
  if (task.subject && SUBJECT_BADGES[task.subject]) return SUBJECT_BADGES[task.subject]
  const title = task.title || ''
  const inferredSubject = Object.keys(SUBJECT_BADGES).find((subject) => title.includes(subject))
  return inferredSubject ? SUBJECT_BADGES[inferredSubject] : DEFAULT_SUBJECT_BADGE
}

function getDescriptionLines(task) {
  return (task.description || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

function formatDuration(task) {
  const minutes =
    task.durationMinutes || Math.max(0, parseTimeToMinutes(task.endTime) - parseTimeToMinutes(task.startTime))
  if (!minutes) return '0dk'
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours === 0) return `${mins}dk`
  if (mins === 0) return `${hours}sa`
  return `${hours}sa ${mins}dk`
}

function TimeBlock({ task }) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-xl bg-panel-surface-soft px-3 py-2 sm:block sm:bg-transparent sm:p-0">
      <div className="min-w-0">
        <p className="whitespace-nowrap text-sm font-bold text-panel-text">{task.startTime}</p>
        <p className="whitespace-nowrap text-xs font-medium text-panel-text-muted">{task.endTime}</p>
      </div>
      <span className="inline-flex h-7 shrink-0 items-center rounded-full bg-white px-2.5 text-xs font-semibold text-panel-text-muted shadow-sm sm:mt-2">
        {formatDuration(task)}
      </span>
    </div>
  )
}

function StatusPill({ status }) {
  const { icon: Icon, className } = STATUS_STYLES[status] || STATUS_STYLES.bekliyor

  return (
    <span className={`inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold ${className}`}>
      <Icon size={13} className="shrink-0" aria-hidden="true" />
      {STATUS_LABELS[status] || status}
    </span>
  )
}

function TimelineDot({ status, isFirst, isLast }) {
  const completed = status === 'tamamlandi'

  return (
    <div className="relative hidden justify-center sm:flex">
      {!isFirst ? <span className="absolute top-0 h-5 w-px bg-panel-border" aria-hidden="true" /> : null}
      {!isLast ? <span className="absolute bottom-0 top-5 w-px bg-panel-border" aria-hidden="true" /> : null}
      <span
        className={`relative mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 bg-panel-surface ${
          completed ? 'border-panel-sage text-panel-sage' : 'border-panel-blue-soft text-panel-blue'
        }`}
      >
        {completed ? <CheckCircle2 size={13} aria-hidden="true" /> : <span className="h-2 w-2 rounded-full bg-current" />}
      </span>
    </div>
  )
}

function SubjectBadge({ task }) {
  const { icon: Icon, text, soft, border } = getSubjectBadge(task)
  return (
    <span className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${text} ${soft} ${border}`}>
      <Icon size={13} className="shrink-0" aria-hidden="true" />
      <span className="truncate">{task.title || task.subject || 'Görev'}</span>
    </span>
  )
}

function TaskDetail({ task, expanded }) {
  const lines = getDescriptionLines(task)
  const primary = lines[0] || task.title || 'Görev detayı eklenmemiş.'
  const secondary = expanded ? lines.slice(1) : lines.slice(1, 3)
  const hasHiddenLines = !expanded && lines.length > 3

  return (
    <div className="min-w-0">
      <p className="line-clamp-2 text-base font-bold text-panel-text">{primary}</p>
      {secondary.length > 0 ? (
        <div className="mt-1 space-y-0.5">
          {secondary.map((line, index) => (
            <p key={`${task.id}-detail-${index}`} className="line-clamp-1 text-sm text-panel-text-muted">
              {line}
              {hasHiddenLines && index === secondary.length - 1 ? '...' : ''}
            </p>
          ))}
        </div>
      ) : null}
      {expanded && task.notes ? (
        <p className="mt-3 rounded-xl bg-panel-surface-soft px-3 py-2 text-sm text-panel-text">Not: {task.notes}</p>
      ) : null}
    </div>
  )
}

const ACTION_MENU_WIDTH = 180
const ACTION_MENU_ESTIMATED_HEIGHT = 188
const ACTION_MENU_VIEWPORT_PADDING = 8
const ACTION_MENU_GAP = 6

function getActionMenuPosition(buttonRect, menuHeight = ACTION_MENU_ESTIMATED_HEIGHT) {
  const left = Math.min(
    Math.max(ACTION_MENU_VIEWPORT_PADDING, buttonRect.right - ACTION_MENU_WIDTH),
    window.innerWidth - ACTION_MENU_WIDTH - ACTION_MENU_VIEWPORT_PADDING,
  )
  const hasRoomBelow = window.innerHeight - buttonRect.bottom >= menuHeight + ACTION_MENU_GAP
  const top = hasRoomBelow
    ? buttonRect.bottom + ACTION_MENU_GAP
    : Math.max(ACTION_MENU_VIEWPORT_PADDING, buttonRect.top - menuHeight - ACTION_MENU_GAP)

  return { left, top }
}

function TaskActionsMenu({ isOpen, onToggle, onClose, onView, onEdit, onMove, onNote, onDelete }) {
  const buttonRef = useRef(null)
  const menuRef = useRef(null)
  const [menuPosition, setMenuPosition] = useState(null)

  useLayoutEffect(() => {
    if (!isOpen) return undefined

    const updateMenuPosition = () => {
      const buttonRect = buttonRef.current?.getBoundingClientRect()
      if (!buttonRect) return

      const menuHeight = menuRef.current?.offsetHeight || ACTION_MENU_ESTIMATED_HEIGHT
      setMenuPosition(getActionMenuPosition(buttonRect, menuHeight))
    }

    const frameId = window.requestAnimationFrame(updateMenuPosition)
    window.addEventListener('resize', updateMenuPosition)
    window.addEventListener('scroll', updateMenuPosition, true)
    return () => {
      window.cancelAnimationFrame(frameId)
      window.removeEventListener('resize', updateMenuPosition)
      window.removeEventListener('scroll', updateMenuPosition, true)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return undefined

    function handlePointerDown(event) {
      if (buttonRef.current?.contains(event.target) || menuRef.current?.contains(event.target)) return
      onClose()
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  const items = [
    { label: 'Detay', icon: Eye, onClick: onView },
    { label: 'Düzenle', icon: Pencil, onClick: onEdit },
    { label: 'Taşı', icon: ArrowRightLeft, onClick: onMove },
    { label: 'Not Ekle', icon: NotebookPen, onClick: onNote },
    { label: 'Sil', icon: Trash2, onClick: onDelete, danger: true },
  ]

  return (
    <div className="relative inline-block text-left">
      <button
        ref={buttonRef}
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          if (isOpen) {
            setMenuPosition(null)
          } else if (buttonRef.current) {
            setMenuPosition(getActionMenuPosition(buttonRef.current.getBoundingClientRect()))
          }
          onToggle()
        }}
        aria-label="Görev işlemleri"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        title="Görev işlemleri"
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-panel-border bg-panel-surface text-panel-text-muted transition-colors hover:bg-panel-surface-soft hover:text-panel-text"
      >
        <MoreHorizontal size={18} aria-hidden="true" />
      </button>

      {isOpen && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              style={{
                left: menuPosition?.left ?? 0,
                top: menuPosition?.top ?? 0,
                width: ACTION_MENU_WIDTH,
              }}
              className={`fixed z-[70] overflow-hidden rounded-xl border border-panel-border bg-white py-1 shadow-[0_10px_28px_rgba(37,30,60,0.14)] ${
                menuPosition ? 'opacity-100' : 'pointer-events-none opacity-0'
              }`}
            >
              {items.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  role="menuitem"
                  onClick={(event) => {
                    event.stopPropagation()
                    onClose()
                    item.onClick()
                  }}
                  className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm focus-visible:outline-none focus-visible:bg-panel-surface-soft ${
                    item.danger ? 'text-panel-red hover:bg-panel-red-soft' : 'text-panel-text hover:bg-panel-surface-soft'
                  }`}
                >
                  <item.icon size={14} className="shrink-0" aria-hidden="true" />
                  {item.label}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}

function NoteEditor({ task, noteText, onChange, onSave, onCancel }) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        onSave(task)
      }}
      className="mt-4 flex flex-col gap-2 rounded-xl border border-panel-border bg-panel-surface-soft p-3 sm:flex-row"
    >
      <input
        value={noteText}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-9 flex-1 rounded-xl border border-panel-border bg-panel-surface px-3 text-sm text-panel-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-panel-blue"
        placeholder="Bu görevle ilgili bir not yaz"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          className="inline-flex h-9 items-center justify-center rounded-xl bg-panel-blue px-3 text-sm font-semibold text-white hover:opacity-90"
        >
          Kaydet
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-9 items-center justify-center rounded-xl border border-panel-border px-3 text-sm font-medium text-panel-text hover:bg-panel-surface"
        >
          Vazgeç
        </button>
      </div>
    </form>
  )
}

function TaskAgendaItem({
  task,
  isFirst,
  isLast,
  expanded,
  isMenuOpen,
  noteDraftActive,
  noteText,
  onToggleMenu,
  onCloseMenu,
  onToggleExpanded,
  onEdit,
  onMove,
  onDelete,
  onStartNote,
  onNoteChange,
  onSaveNote,
  onCancelNote,
}) {
  const completed = task.status === 'tamamlandi'

  return (
    <article
      className={`grid grid-cols-[minmax(0,1fr)_2.5rem] gap-3 px-4 py-4 transition-colors sm:grid-cols-[7rem_2rem_minmax(0,1fr)_2.5rem] sm:gap-4 sm:px-5 ${
        completed ? 'bg-panel-sage-soft/30' : 'bg-panel-surface hover:bg-panel-surface-soft/60'
      }`}
    >
      <div className="col-start-1 row-start-1 min-w-0 sm:col-start-1 sm:row-start-1">
        <TimeBlock task={task} />
      </div>

      <TimelineDot status={task.status} isFirst={isFirst} isLast={isLast} />

      <div className="col-span-2 col-start-1 row-start-2 min-w-0 sm:col-span-1 sm:col-start-3 sm:row-start-1">
        <div className="flex flex-wrap items-center gap-2">
          <SubjectBadge task={task} />
          <StatusPill status={task.status} />
        </div>
        <div className="mt-3">
          <TaskDetail task={task} expanded={expanded} />
        </div>
        {noteDraftActive ? (
          <NoteEditor
            task={task}
            noteText={noteText}
            onChange={onNoteChange}
            onSave={onSaveNote}
            onCancel={onCancelNote}
          />
        ) : null}
      </div>

      <div className="col-start-2 row-start-1 justify-self-end sm:col-start-4 sm:row-start-1">
        <TaskActionsMenu
          isOpen={isMenuOpen}
          onToggle={onToggleMenu}
          onClose={onCloseMenu}
          onView={onToggleExpanded}
          onEdit={onEdit}
          onMove={onMove}
          onNote={onStartNote}
          onDelete={onDelete}
        />
      </div>
    </article>
  )
}

export default function DailyPlanTable({ tasks, onEdit, onMove, onDelete, onSaveNote, onAddTask }) {
  const [expandedId, setExpandedId] = useState(null)
  const [openMenuId, setOpenMenuId] = useState(null)
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
    <section className="panel-card overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-panel-border p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-panel-blue-soft text-panel-blue">
            <CalendarDays size={19} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-panel-text">Günün Akışı</h2>
            <p className="mt-0.5 text-sm text-panel-text-muted">{sorted.length} görev planlandı</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-panel-border bg-panel-surface px-3.5 text-sm font-medium text-panel-text transition-colors hover:bg-panel-surface-soft"
        >
          <Printer size={16} aria-hidden="true" />
          Yazdır
        </button>
      </div>

      {sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-5 py-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-panel-blue-soft text-panel-blue">
            <CalendarDays size={22} aria-hidden="true" />
          </span>
          <h3 className="mt-4 text-lg font-semibold text-panel-text">Bugün plan boş</h3>
          <p className="mt-1 max-w-sm text-sm text-panel-text-muted">Aylin için ilk görevi ekleyebilirsin.</p>
          <button
            type="button"
            onClick={onAddTask}
            className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-panel-blue px-4 text-sm font-semibold text-white hover:opacity-90"
          >
            <Plus size={17} aria-hidden="true" />
            Görev Ekle
          </button>
        </div>
      ) : (
        <div className="divide-y divide-panel-border">
          {sorted.map((task, index) => (
            <TaskAgendaItem
              key={task.id}
              task={task}
              isFirst={index === 0}
              isLast={index === sorted.length - 1}
              expanded={expandedId === task.id}
              isMenuOpen={openMenuId === task.id}
              noteDraftActive={noteDraftId === task.id}
              noteText={noteText}
              onToggleMenu={() => setOpenMenuId(openMenuId === task.id ? null : task.id)}
              onCloseMenu={() => setOpenMenuId(null)}
              onToggleExpanded={() => setExpandedId(expandedId === task.id ? null : task.id)}
              onEdit={() => onEdit(task)}
              onMove={() => onMove(task)}
              onDelete={() => onDelete(task)}
              onStartNote={() => startNoteDraft(task)}
              onNoteChange={setNoteText}
              onSaveNote={saveNote}
              onCancelNote={() => setNoteDraftId(null)}
            />
          ))}
        </div>
      )}
    </section>
  )
}
