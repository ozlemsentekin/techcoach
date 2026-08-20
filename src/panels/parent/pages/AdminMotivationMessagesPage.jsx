import { useEffect, useMemo, useState } from 'react'
import { Sparkles, Pencil, X } from 'lucide-react'
import {
  MOTIVATION_CATEGORIES,
  getMotivationMessagePool,
  createMotivationMessage,
  updateMotivationMessage,
} from '../../../services/contentService'
import PageHeader from '../../layout/PageHeader'
import LoadingState from '../../shared/LoadingState'
import EmptyState from '../../shared/EmptyState'
import Button from '../../ui/Button'

const CATEGORY_LABELS = {
  general: 'Genel',
  low_energy: 'Düşük Enerji',
  high_stress: 'Yüksek Stres',
  start_easy: 'Kolay Başlangıç',
  task_started: 'Başladı',
  partial_completion: 'Kısmen Tamamlandı',
  strong_progress: 'Güçlü İlerleme',
  completed_day: 'Gün Tamamlandı',
}

function MessageModal({ message, defaultCategory, onSaved, onClose }) {
  const isEdit = Boolean(message)
  const [category, setCategory] = useState(message?.category || defaultCategory)
  const [title, setTitle] = useState(message?.title || '')
  const [body, setBody] = useState(message?.body || '')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (title.trim().length < 2) {
      setError('Başlık en az 2 karakter olmalı.')
      return
    }
    if (body.trim().length < 2) {
      setError('Mesaj metni en az 2 karakter olmalı.')
      return
    }

    setError('')
    setLoading(true)
    try {
      const payload = { category, title: title.trim(), body: body.trim() }
      const saved = isEdit
        ? await updateMotivationMessage(message.id, { ...payload, isActive: message.isActive })
        : await createMotivationMessage(payload)
      onSaved(saved)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-0 sm:items-center sm:p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-t-3xl border border-panel-border bg-panel-surface p-5 shadow-panel-1 sm:rounded-2xl"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-panel-text">{isEdit ? 'Mesajı Düzenle' : 'Mesaj Ekle'}</h2>
          <button type="button" aria-label="Kapat" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {error ? (
          <div className="mb-3 rounded-xl bg-panel-accent-soft px-3 py-2.5 text-sm text-panel-warm">{error}</div>
        ) : null}

        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-panel-text-muted">Kategori</span>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="rounded-xl border border-panel-border p-2.5 text-base text-panel-text"
            >
              {MOTIVATION_CATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {CATEGORY_LABELS[value]}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-panel-text-muted">Başlık</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="rounded-xl border border-panel-border p-2.5 text-base text-panel-text"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-panel-text-muted">Mesaj Metni</span>
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={3}
              className="rounded-xl border border-panel-border p-2.5 text-base text-panel-text"
            />
          </label>

          <Button type="submit" disabled={loading} size="md" className="w-full">
            {loading ? 'Kaydediliyor...' : isEdit ? 'Kaydet' : 'Mesaj Oluştur'}
          </Button>
        </div>
      </form>
    </div>
  )
}

function CategorySection({ category, messages, onAddMessage, onEditMessage, onToggleActive }) {
  return (
    <div className="panel-card p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-panel-text">{CATEGORY_LABELS[category]}</h2>
        <Button variant="secondary" size="sm" onClick={() => onAddMessage(category)}>
          + Mesaj Ekle
        </Button>
      </div>

      {messages.length === 0 ? (
        <p className="text-sm text-panel-text-muted">Bu kategoride henüz mesaj yok.</p>
      ) : (
        <div className="flex flex-col divide-y divide-panel-border">
          {messages.map((message) => (
            <div key={message.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-panel-text">{message.title}</span>
                  <button
                    type="button"
                    aria-label="Mesajı düzenle"
                    className="text-panel-text-muted hover:text-panel-text"
                    onClick={() => onEditMessage(message)}
                  >
                    <Pencil size={13} aria-hidden="true" />
                  </button>
                </div>
                <p className="mt-0.5 text-sm text-panel-text-muted">{message.body}</p>
              </div>
              <button
                type="button"
                onClick={() => onToggleActive(message)}
                className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                  message.isActive ? 'bg-panel-blue-soft text-panel-blue' : 'bg-panel-surface-soft text-panel-text-muted'
                }`}
              >
                {message.isActive ? 'Aktif' : 'Pasif'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function AdminMotivationMessagesPage() {
  const [messages, setMessages] = useState(null)
  const [error, setError] = useState('')
  const [modalState, setModalState] = useState(null)

  const loadData = () => {
    getMotivationMessagePool()
      .then(setMessages)
      .catch((err) => setError(err.message))
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleSaved = (message) => {
    setMessages((current) => {
      const exists = (current || []).some((item) => item.id === message.id)
      return exists ? current.map((item) => (item.id === message.id ? message : item)) : [...(current || []), message]
    })
    setModalState(null)
  }

  const handleToggleActive = async (message) => {
    try {
      const saved = await updateMotivationMessage(message.id, {
        category: message.category,
        title: message.title,
        body: message.body,
        isActive: !message.isActive,
      })
      handleSaved(saved)
    } catch (err) {
      setError(err.message)
    }
  }

  const messagesByCategory = useMemo(() => {
    const grouped = Object.fromEntries(MOTIVATION_CATEGORIES.map((category) => [category, []]))
    for (const message of messages || []) {
      grouped[message.category]?.push(message)
    }
    return grouped
  }, [messages])

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Motivasyon Mesajları" />

      {error ? (
        <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-base text-panel-warm">{error}</div>
      ) : messages === null ? (
        <LoadingState label="Mesajlar yükleniyor..." />
      ) : messages.length === 0 ? (
        <EmptyState icon={Sparkles} title="Henüz mesaj yok" />
      ) : (
        <div className="fade-slide-in flex flex-col gap-4">
          {MOTIVATION_CATEGORIES.map((category) => (
            <CategorySection
              key={category}
              category={category}
              messages={messagesByCategory[category]}
              onAddMessage={(cat) => setModalState({ defaultCategory: cat })}
              onEditMessage={(message) => setModalState({ message })}
              onToggleActive={handleToggleActive}
            />
          ))}
        </div>
      )}

      {modalState ? (
        <MessageModal
          message={modalState.message}
          defaultCategory={modalState.defaultCategory || MOTIVATION_CATEGORIES[0]}
          onSaved={handleSaved}
          onClose={() => setModalState(null)}
        />
      ) : null}
    </div>
  )
}
