import { useEffect, useMemo, useState } from 'react'
import { ClipboardList } from 'lucide-react'
import PageHeader from '../../layout/PageHeader'
import LoadingState from '../../shared/LoadingState'
import EmptyState from '../../shared/EmptyState'
import Button from '../../ui/Button'
import {
  getAdminPanelRequests,
  updateAdminPanelRequest,
} from '../../../services/panelRequestService'
import { formatRequestDate, roleLabel } from '../../shared/requests/requestFormat'
import { RequestStatusBadge } from '../../shared/requests/requestPresentation'
import RequestDetailModal from '../../shared/requests/RequestDetailModal'

const TABS = [
  { key: 'beklemede', label: 'Beklemede' },
  { key: 'tamamlandi', label: 'Tamamlandı' },
  { key: 'iptal', label: 'İptal' },
  { key: 'all', label: 'Tümü' },
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

function AdminActions({ request, onDone }) {
  const [mode, setMode] = useState(null) // 'tamamlandi' | 'iptal'
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  if (request.status !== 'beklemede') {
    return (
      <p className="text-sm text-panel-text-muted">
        Bu talep {request.status === 'tamamlandi' ? 'tamamlandı' : 'iptal edildi'}
        {request.reviewedAt ? ` · ${formatRequestDate(request.reviewedAt)}` : ''}.
      </p>
    )
  }

  const submit = async () => {
    setSaving(true)
    setError('')
    try {
      const updated = await updateAdminPanelRequest(request.id, { status: mode, adminNote: note.trim() || undefined })
      onDone(updated)
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  if (!mode) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-xs text-panel-text-muted">
          Tamamlandı işaretlemeden önce kitabı Kütüphane'ye eklediğinizden emin olun.
        </p>
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
        <Button onClick={submit} disabled={saving}>
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
  const [requests, setRequests] = useState(null)
  const [error, setError] = useState('')
  const [detailId, setDetailId] = useState(null)

  const load = () => {
    setRequests(null)
    getAdminPanelRequests({
      type: 'kitap-ekleme',
      status: tab === 'all' ? undefined : tab,
    })
      .then(setRequests)
      .catch((err) => setError(err.message))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

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
        title="Kitap Talepleri"
        subtitle="Veli ve öğretmenlerin kütüphaneye eklenmesini istediği kitaplar."
      />

      <div className="flex gap-1 overflow-x-auto border-b border-panel-border">
        {TABS.map((item) => (
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
        <EmptyState icon={ClipboardList} title="Talep yok" description="Bu durumda talep bulunmuyor." />
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
                  <p className="truncate text-base font-semibold text-panel-text">
                    {request.book?.bookName || 'Kitap adı belirtilmemiş'}
                  </p>
                  <p className="mt-0.5 text-xs text-panel-text-muted">
                    {[request.requesterName, roleLabel(request.createdByRole)].filter(Boolean).join(' · ')}
                    {' · '}
                    {formatRequestDate(request.createdAt)}
                  </p>
                </div>
                <RequestStatusBadge status={request.status} />
              </div>
              <p className="text-xs text-panel-text-muted">
                {[request.book?.publisherName, request.book?.grade ? `${request.book.grade}. sınıf` : null]
                  .filter(Boolean)
                  .join(' · ')}
                {photoSummary(request.photoCounts) ? ` — ${photoSummary(request.photoCounts)}` : ''}
              </p>
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
