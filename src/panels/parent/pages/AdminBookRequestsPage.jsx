import { useEffect, useMemo, useState } from 'react'
import { ClipboardList } from 'lucide-react'
import PageHeader from '../../layout/PageHeader'
import LoadingState from '../../shared/LoadingState'
import EmptyState from '../../shared/EmptyState'
import Button from '../../ui/Button'
import {
  getAdminPanelRequests,
  updateAdminPanelRequest,
  PANEL_REQUEST_TYPE_LABELS,
} from '../../../services/panelRequestService'
import { formatRequestDate, roleLabel } from '../../shared/requests/requestFormat'
import { RequestStatusBadge } from '../../shared/requests/requestPresentation'
import RequestDetailModal from '../../shared/requests/RequestDetailModal'

const STATUS_TABS = [
  { key: 'beklemede', label: 'Beklemede' },
  { key: 'tamamlandi', label: 'Tamamlandı' },
  { key: 'iptal', label: 'İptal' },
  { key: 'all', label: 'Tümü' },
]

const TYPE_FILTERS = [
  { key: 'all', label: 'Tüm türler' },
  { key: 'genel', label: 'Genel' },
  { key: 'kitap-ekleme', label: 'Kitap ekleme' },
]

function photoSummary(counts) {
  if (!counts) return ''
  return [
    counts.kapak ? '1 kapak' : null,
    counts.icindekiler ? `${counts.icindekiler} içindekiler` : null,
    counts.cevapAnahtari ? `${counts.cevapAnahtari} cevap anahtarı` : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

function cardTitle(request) {
  if (request.type === 'genel') return request.title || 'Genel talep'
  return request.book?.bookName || 'Kitap adı belirtilmemiş'
}

function AdminActions({ request, onDone }) {
  const [mode, setMode] = useState(null) // 'tamamlandi' | 'iptal' | 'beklemede'
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async (status, requireNote) => {
    setSaving(true)
    setError('')
    try {
      const updated = await updateAdminPanelRequest(request.id, {
        status,
        adminNote: requireNote ? note.trim() || undefined : undefined,
      })
      onDone(updated)
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  if (request.status !== 'beklemede') {
    return (
      <div className="flex flex-col gap-2">
        {error ? <p className="text-sm text-panel-warm">{error}</p> : null}
        <p className="text-sm text-panel-text-muted">
          Bu talep {request.status === 'tamamlandi' ? 'tamamlandı' : 'iptal edildi'}
          {request.reviewedAt ? ` · ${formatRequestDate(request.reviewedAt)}` : ''}.
        </p>
        <div>
          <Button variant="secondary" size="sm" onClick={() => submit('beklemede', false)} disabled={saving}>
            {saving ? 'Açılıyor...' : 'Yeniden aç'}
          </Button>
        </div>
      </div>
    )
  }

  if (!mode) {
    return (
      <div className="flex flex-col gap-2">
        {request.type === 'kitap-ekleme' ? (
          <p className="text-xs text-panel-text-muted">
            Tamamlandı işaretlemeden önce kitabı Kütüphane'ye eklediğinizden emin olun.
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setMode('tamamlandi')}>Tamamlandı olarak işaretle</Button>
          <Button variant="secondary" onClick={() => setMode('iptal')}>
            İptal et
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {error ? <p className="text-sm text-panel-warm">{error}</p> : null}
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-panel-text-muted">
          {mode === 'tamamlandi' ? 'Talep sahibine not (opsiyonel)' : 'İptal nedeni (opsiyonel)'}
        </span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          maxLength={1000}
          className="rounded-xl border border-panel-border p-2.5 text-sm text-panel-text"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => submit(mode, true)} disabled={saving}>
          {saving ? 'Kaydediliyor...' : mode === 'tamamlandi' ? 'Tamamlandı olarak kaydet' : 'İptal et'}
        </Button>
        <Button variant="ghost" onClick={() => setMode(null)} disabled={saving}>
          Vazgeç
        </Button>
      </div>
    </div>
  )
}

export default function AdminBookRequestsPage() {
  const [tab, setTab] = useState('beklemede')
  const [typeFilter, setTypeFilter] = useState('all')
  const [requests, setRequests] = useState(null)
  const [error, setError] = useState('')
  const [detailId, setDetailId] = useState(null)

  const load = () => {
    setRequests(null)
    getAdminPanelRequests({
      type: typeFilter === 'all' ? undefined : typeFilter,
      status: tab === 'all' ? undefined : tab,
    })
      .then(setRequests)
      .catch((err) => setError(err.message))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, typeFilter])

  const pendingCount = useMemo(
    () => (tab === 'beklemede' && requests ? requests.length : null),
    [tab, requests],
  )

  const handleDone = () => {
    setDetailId(null)
    load()
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Talepler"
        subtitle="Veli, öğretmen ve öğrencilerin sistem yöneticilerine ilettiği talepler."
      />

      <div className="flex flex-wrap gap-2">
        {TYPE_FILTERS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTypeFilter(item.key)}
            className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
              typeFilter === item.key
                ? 'border-panel-blue bg-panel-blue-soft/60 text-panel-blue'
                : 'border-panel-border text-panel-text-muted hover:text-panel-text'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-panel-border">
        {STATUS_TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={`shrink-0 whitespace-nowrap border-b-2 px-3 pb-2.5 text-sm font-semibold transition-colors ${
              tab === item.key
                ? 'border-panel-blue text-panel-blue'
                : 'border-transparent text-panel-text-muted hover:text-panel-text'
            }`}
          >
            {item.label}
            {item.key === 'beklemede' && pendingCount ? (
              <span className="ml-1.5 text-xs font-medium text-panel-text-muted">({pendingCount})</span>
            ) : null}
          </button>
        ))}
      </div>

      {error ? (
        <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-base text-panel-warm">{error}</div>
      ) : requests === null ? (
        <LoadingState label="Talepler yükleniyor..." />
      ) : requests.length === 0 ? (
        <EmptyState icon={ClipboardList} title="Talep yok" description="Bu filtrede talep bulunmuyor." />
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {requests.map((request) => (
            <button
              key={request.id}
              type="button"
              onClick={() => setDetailId(request.id)}
              className="flex flex-col gap-1.5 rounded-2xl border border-panel-border bg-panel-surface p-4 text-left transition-colors hover:border-panel-blue"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-panel-text">{cardTitle(request)}</p>
                  <p className="mt-0.5 text-xs text-panel-text-muted">
                    {PANEL_REQUEST_TYPE_LABELS[request.type]}
                    {' · '}
                    {[request.requesterName, roleLabel(request.createdByRole)].filter(Boolean).join(' · ')}
                    {' · '}
                    {formatRequestDate(request.createdAt)}
                  </p>
                </div>
                <RequestStatusBadge status={request.status} />
              </div>
              {request.type === 'genel' ? (
                request.description ? (
                  <p className="line-clamp-2 text-xs text-panel-text-muted">{request.description}</p>
                ) : null
              ) : (
                <p className="text-xs text-panel-text-muted">
                  {[request.book?.publisherName, request.book?.grade ? `${request.book.grade}. sınıf` : null]
                    .filter(Boolean)
                    .join(' · ')}
                  {photoSummary(request.photoCounts) ? ` — ${photoSummary(request.photoCounts)}` : ''}
                </p>
              )}
            </button>
          ))}
        </div>
      )}

      {detailId ? (
        <RequestDetailModal
          requestId={detailId}
          showRequester
          renderActions={(detail) => <AdminActions request={detail} onDone={handleDone} />}
          onClose={() => setDetailId(null)}
        />
      ) : null}
    </div>
  )
}
