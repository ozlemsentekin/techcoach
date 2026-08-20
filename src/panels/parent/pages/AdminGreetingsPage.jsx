import { useEffect, useMemo, useState } from 'react'
import { Clock, Pencil, Plus, Trash2, X } from 'lucide-react'
import {
  createGreetingRule,
  deleteGreetingRule,
  getGreetingRules,
  updateGreetingRule,
} from '../../../services/contentService'
import PageHeader from '../../layout/PageHeader'
import LoadingState from '../../shared/LoadingState'
import EmptyState from '../../shared/EmptyState'
import Button from '../../ui/Button'

function formatHour(hour) {
  return `${String(hour).padStart(2, '0')}:00`
}

function getRuleStartHour(rules, rule) {
  const index = rules.findIndex((item) => item.id === rule.id)
  return index <= 0 ? 0 : rules[index - 1].endHour
}

function RuleModal({ rule, rules, onSaved, onClose }) {
  const isEdit = Boolean(rule)
  const [label, setLabel] = useState(rule?.label || '')
  const [endHour, setEndHour] = useState(rule ? String(rule.endHour) : '12')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const usedHours = new Set(rules.filter((item) => item.id !== rule?.id).map((item) => item.endHour))
  const hourOptions = Array.from({ length: 24 }, (_, index) => index + 1)

  const handleSubmit = async (event) => {
    event.preventDefault()

    const normalizedLabel = label.trim()
    const numericEndHour = Number(endHour)

    if (normalizedLabel.length < 2) {
      setError('Etiket en az 2 karakter olmalı.')
      return
    }

    if (!Number.isInteger(numericEndHour) || numericEndHour < 1 || numericEndHour > 24) {
      setError('Bitiş saati 1 ile 24 arasında olmalı.')
      return
    }

    setError('')
    setLoading(true)
    try {
      const payload = { label: normalizedLabel, endHour: numericEndHour }
      const saved = isEdit ? await updateGreetingRule(rule.id, payload) : await createGreetingRule(payload)
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
          <h2 className="text-lg font-semibold text-panel-text">{isEdit ? 'Kuralı Düzenle' : 'Kural Ekle'}</h2>
          <button type="button" aria-label="Kapat" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {error ? (
          <div className="mb-3 rounded-xl bg-panel-accent-soft px-3 py-2.5 text-sm text-panel-warm">{error}</div>
        ) : null}

        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-panel-text-muted">Selamlama Metni</span>
            <input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              className="rounded-xl border border-panel-border p-2.5 text-base text-panel-text"
              placeholder="Günaydın"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-panel-text-muted">Bitiş Saati</span>
            <select
              value={endHour}
              onChange={(event) => setEndHour(event.target.value)}
              className="rounded-xl border border-panel-border p-2.5 text-base text-panel-text"
            >
              {hourOptions.map((hour) => (
                <option key={hour} value={hour} disabled={usedHours.has(hour)}>
                  {formatHour(hour)}
                </option>
              ))}
            </select>
          </label>

          <Button type="submit" disabled={loading} size="md" className="w-full">
            {loading ? 'Kaydediliyor...' : isEdit ? 'Kaydet' : 'Kural Oluştur'}
          </Button>
        </div>
      </form>
    </div>
  )
}

function GreetingRuleCard({ rule, rules, onEdit, onDelete }) {
  const startHour = getRuleStartHour(rules, rule)

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-panel-border bg-panel-surface p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-panel-blue-soft text-panel-blue">
            <Clock size={16} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-panel-text">{rule.label}</p>
            <p className="mt-0.5 text-sm text-panel-text-muted">
              {formatHour(startHour)} - {formatHour(rule.endHour)}
            </p>
          </div>
        </div>
      </div>

      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          aria-label="Kuralı düzenle"
          onClick={() => onEdit(rule)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-panel-border text-panel-text-muted hover:bg-panel-surface-soft hover:text-panel-text"
        >
          <Pencil size={15} aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Kuralı sil"
          onClick={() => onDelete(rule)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-panel-border text-panel-red hover:bg-panel-red-soft"
        >
          <Trash2 size={15} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}

export default function AdminGreetingsPage() {
  const [rules, setRules] = useState(null)
  const [error, setError] = useState('')
  const [modalState, setModalState] = useState(null)

  const sortedRules = useMemo(() => [...(rules || [])].sort((a, b) => a.endHour - b.endHour), [rules])

  const loadData = () => {
    getGreetingRules()
      .then(setRules)
      .catch((err) => setError(err.message))
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleSaved = (rule) => {
    setRules((current) => {
      const exists = (current || []).some((item) => item.id === rule.id)
      const next = exists ? current.map((item) => (item.id === rule.id ? rule : item)) : [...(current || []), rule]
      return next.sort((a, b) => a.endHour - b.endHour)
    })
    setModalState(null)
  }

  const handleDelete = async (rule) => {
    try {
      await deleteGreetingRule(rule.id)
      setRules((current) => (current || []).filter((item) => item.id !== rule.id))
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Selamlama Metinleri"
        subtitle="Öğrenci panelinde saate göre gösterilen karşılama metinleri."
        actions={
          <Button size="md" onClick={() => setModalState({})}>
            <Plus size={16} aria-hidden="true" />
            Kural Ekle
          </Button>
        }
      />

      {error ? (
        <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-base text-panel-warm">{error}</div>
      ) : rules === null ? (
        <LoadingState label="Selamlama kuralları yükleniyor..." />
      ) : sortedRules.length === 0 ? (
        <EmptyState icon={Clock} title="Henüz kural yok" description="İlk selamlama aralığını ekleyebilirsin." />
      ) : (
        <div className="fade-slide-in panel-card p-5">
          <div className="grid gap-3">
            {sortedRules.map((rule) => (
              <GreetingRuleCard
                key={rule.id}
                rule={rule}
                rules={sortedRules}
                onEdit={(selectedRule) => setModalState({ rule: selectedRule })}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </div>
      )}

      {modalState ? (
        <RuleModal
          rule={modalState.rule}
          rules={sortedRules}
          onSaved={handleSaved}
          onClose={() => setModalState(null)}
        />
      ) : null}
    </div>
  )
}
