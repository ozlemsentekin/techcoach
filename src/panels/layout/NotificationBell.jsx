import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { Bell, CheckCheck, CheckCircle2, CircleDot, HelpCircle, Loader2, PlayCircle, X } from 'lucide-react'
import { useAuth } from '../../context/useAuth'
import useVisiblePolling from '../../hooks/useVisiblePolling'
import { formatDateShort } from '../../utils/time'
import { resolveCompletionFlow } from '../shared/taskCompletion'
import { getTaskById } from '../../services/taskService'
import { getTeacherStudentTask } from '../../services/teacherService'
import {
  getParentNotifications,
  getTeacherNotifications,
  markAllParentNotificationsRead,
  markAllTeacherNotificationsRead,
  markParentNotificationRead,
  markTeacherNotificationRead,
} from '../../services/notificationService'

const TaskAnswerSheetModal = lazy(() => import('../student/components/TaskAnswerSheetModal'))
const TaskOpticalResultModal = lazy(() => import('../teacher/components/TaskOpticalResultModal'))
const TaskDetailModal = lazy(() => import('../teacher/components/TaskDetailModal'))

const POLL_MS = 30000
const LIST_LIMIT = 40

const SERVICES = {
  parent: {
    list: getParentNotifications,
    markRead: markParentNotificationRead,
    markAll: markAllParentNotificationsRead,
  },
  teacher: {
    list: getTeacherNotifications,
    markRead: markTeacherNotificationRead,
    markAll: markAllTeacherNotificationsRead,
  },
}

const ACTION_LABEL = {
  task_completed: 'görevi tamamladı',
  task_partially_completed: 'görevi kısmen tamamladı',
  task_started: 'göreve başladı',
  help_requested: 'yardım istedi',
}

function ActionIcon({ action }) {
  if (action === 'task_completed') return <CheckCircle2 size={16} className="text-emerald-600" aria-hidden="true" />
  if (action === 'task_partially_completed') return <CircleDot size={16} className="text-amber-500" aria-hidden="true" />
  if (action === 'help_requested') return <HelpCircle size={16} className="text-panel-red" aria-hidden="true" />
  return <PlayCircle size={16} className="text-panel-blue" aria-hidden="true" />
}

function formatRelativeTime(iso) {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return ''
  const diffSec = Math.round((Date.now() - then) / 1000)
  if (diffSec < 60) return 'az önce'
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} dk önce`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} sa önce`
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)} gün önce`
  return new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
}

function resourceLabel(notif) {
  if (notif.resourceBookName) {
    return notif.publisherName ? `${notif.publisherName} — ${notif.resourceBookName}` : notif.resourceBookName
  }
  return notif.taskTitle || 'Görev'
}

function buildDetailLine(notif) {
  const parts = []
  if (notif.taskDate) parts.push(formatDateShort(notif.taskDate))
  if (notif.subject) parts.push(notif.subject)
  parts.push(resourceLabel(notif))
  if (notif.targetQuestionCount) parts.push(`${notif.targetQuestionCount} soru`)
  if (notif.action === 'task_completed' && notif.correctCount != null) {
    parts.push(`${notif.correctCount}D · ${notif.wrongCount ?? 0}Y · ${notif.blankCount ?? 0}B`)
  }
  return parts.join(' · ')
}

export default function NotificationBell({ role }) {
  const { authUser } = useAuth()
  const service = SERVICES[role]
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [markingAll, setMarkingAll] = useState(false)
  const [detail, setDetail] = useState(null) // { notif, task } | { notif, error }
  const [detailLoading, setDetailLoading] = useState(false)
  const menuRef = useRef(null)

  const refresh = useCallback(async () => {
    if (!service) return
    try {
      const { notifications: rows, unreadCount: count } = await service.list({ limit: LIST_LIMIT })
      setNotifications(rows)
      setUnreadCount(count)
      setError('')
    } catch (err) {
      setError(err?.message || 'Bildirimler yüklenemedi.')
    }
  }, [service])

  // Kimlik değişince (admin impersonate, öğrenci görünümünden çıkış) eski veriyi temizle.
  useEffect(() => {
    setNotifications([])
    setUnreadCount(0)
    setOpen(false)
    setDetail(null)
    setError('')
  }, [authUser?.id])

  useEffect(() => {
    setLoading(true)
    refresh().finally(() => setLoading(false))
  }, [refresh])

  useVisiblePolling(refresh, POLL_MS)

  useEffect(() => {
    if (!open) return undefined
    const handleClick = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const applyRead = (activityId) => {
    setNotifications((rows) =>
      rows.map((row) => (row.id === activityId ? { ...row, isRead: true } : row)),
    )
    setUnreadCount((count) => Math.max(0, count - 1))
  }

  const handleRowClick = async (notif) => {
    if (!notif.isRead) {
      applyRead(notif.id)
      service.markRead(notif.id).catch(() => {})
    }
    if (!notif.taskId) return

    setOpen(false)
    setDetail({ notif })
    setDetailLoading(true)
    try {
      const task =
        role === 'teacher'
          ? await getTeacherStudentTask(notif.studentTeacherId, notif.taskId)
          : await getTaskById(notif.taskId, { studentId: notif.studentId })
      setDetail({ notif, task })
    } catch (err) {
      setDetail({ notif, error: err?.message || 'Görev detayı yüklenemedi.' })
    } finally {
      setDetailLoading(false)
    }
  }

  const handleMarkAll = async () => {
    setMarkingAll(true)
    try {
      await service.markAll()
      await refresh()
    } catch {
      // sessiz: bir sonraki yoklama düzeltir
    } finally {
      setMarkingAll(false)
    }
  }

  if (!service) return null

  const badge = unreadCount > 9 ? '9+' : String(unreadCount)

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={unreadCount > 0 ? `Bildirimler (${unreadCount} okunmamış)` : 'Bildirimler'}
        className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors ${
          open
            ? 'border-panel-blue-soft bg-panel-blue-soft/50 text-panel-text'
            : 'border-transparent text-panel-text-muted hover:border-panel-border hover:bg-panel-surface-soft hover:text-panel-text'
        }`}
      >
        <Bell size={17} aria-hidden="true" />
        {unreadCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-panel-red px-1 text-[10px] font-bold leading-4 text-white">
            {badge}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="fixed inset-x-3 top-16 z-50 max-h-[calc(100dvh-5rem)] min-w-0 overflow-y-auto rounded-2xl border border-panel-border bg-panel-surface shadow-[0_18px_48px_rgba(31,36,77,0.16)] sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-96">
          <div className="flex items-center justify-between gap-2 border-b border-panel-border bg-panel-surface-soft/60 px-4 py-3">
            <span className="text-sm font-extrabold text-panel-text">Bildirimler</span>
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={handleMarkAll}
                disabled={markingAll}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-panel-blue hover:bg-panel-blue-soft/50 disabled:opacity-60"
              >
                <CheckCheck size={13} aria-hidden="true" />
                Tümünü okundu
              </button>
            ) : null}
          </div>

          {loading && notifications.length === 0 ? (
            <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-panel-text-muted">
              <Loader2 size={16} className="animate-spin" aria-hidden="true" /> Yükleniyor...
            </div>
          ) : error && notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-panel-text-muted">{error}</div>
          ) : notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-panel-text-muted">
              Henüz bildirim yok.
            </div>
          ) : (
            <ul className="divide-y divide-panel-border">
              {notifications.map((notif) => (
                <li key={notif.id}>
                  <button
                    type="button"
                    onClick={() => handleRowClick(notif)}
                    className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-panel-surface-soft ${
                      notif.isRead ? '' : 'bg-panel-blue-soft/25'
                    }`}
                  >
                    <span className="mt-0.5 shrink-0">
                      <ActionIcon action={notif.action} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        {notif.isRead ? null : (
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-panel-blue" aria-hidden="true" />
                        )}
                        <span className="truncate text-sm font-bold text-panel-text">
                          {notif.studentName || 'Öğrenci'}{' '}
                          <span className="font-medium text-panel-text-muted">
                            {ACTION_LABEL[notif.action] || 'işlem yaptı'}
                          </span>
                        </span>
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-panel-text-muted" title={buildDetailLine(notif)}>
                        {buildDetailLine(notif)}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-panel-text-muted/80">
                        {formatRelativeTime(notif.createdAt)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {detail ? (
        <NotificationDetail
          role={role}
          detail={detail}
          loading={detailLoading}
          onClose={() => setDetail(null)}
        />
      ) : null}
    </div>
  )
}

function NotificationDetail({ role, detail, loading, onClose }) {
  const { notif, task, error } = detail

  if (loading || (!task && !error)) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
        <div className="flex items-center gap-2 rounded-2xl bg-panel-surface px-5 py-4 text-sm text-panel-text-muted shadow-panel-1">
          <Loader2 size={16} className="animate-spin" aria-hidden="true" /> Görev detayı yükleniyor...
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
        <div
          className="w-full max-w-sm rounded-2xl bg-panel-surface p-5 shadow-panel-1"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-bold text-panel-text">Görev detayı</h2>
            <button type="button" aria-label="Kapat" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
          <p className="text-sm text-panel-text-muted">{error}</p>
        </div>
      </div>
    )
  }

  const flow = resolveCompletionFlow(task)

  if (flow === 'answer_sheet') {
    return (
      <Suspense fallback={null}>
        {role === 'teacher' ? (
          <TaskOpticalResultModal task={task} studentTeacherId={notif.studentTeacherId} onClose={onClose} />
        ) : (
          <TaskAnswerSheetModal
            task={task}
            lessonLabel={task.subject || 'Görev'}
            photoMode="view"
            studentId={notif.studentId}
            onClose={onClose}
          />
        )}
      </Suspense>
    )
  }

  return (
    <Suspense fallback={null}>
      <TaskDetailModal task={task} onClose={onClose} />
    </Suspense>
  )
}
