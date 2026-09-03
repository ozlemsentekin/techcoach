import { useEffect, useState } from 'react'
import { ClipboardList, Plus } from 'lucide-react'
import PageHeader from '../../layout/PageHeader'
import LoadingState from '../LoadingState'
import EmptyState from '../EmptyState'
import Button from '../../ui/Button'
import {
  getMyPanelRequests,
  PANEL_REQUEST_TYPE_LABELS,
} from '../../../services/panelRequestService'
import { formatRequestDate } from './requestFormat'
import { RequestStatusBadge } from './requestPresentation'
import RequestDetailModal from './RequestDetailModal'
import GeneralRequestModal from './GeneralRequestModal'

function photoSummary(counts) {
  if (!counts) return ''
  const parts = []
  if (counts.kapak) parts.push('1 kapak')
  if (counts.icindekiler) parts.push(`${counts.icindekiler} içindekiler`)
  if (counts.cevapAnahtari) parts.push(`${counts.cevapAnahtari} cevap anahtarı`)
  return parts.join(' · ')
}

function requestTitle(request) {
  if (request.type === 'genel') return request.title || 'Genel talep'
  return request.book?.bookName || PANEL_REQUEST_TYPE_LABELS[request.type] || 'Talep'
}

function RequestCard({ request, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col gap-2 rounded-2xl border border-panel-border bg-panel-surface p-4 text-left transition-colors hover:border-panel-blue"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-panel-text">{requestTitle(request)}</p>
          <p className="mt-0.5 text-xs text-panel-text-muted">
            {PANEL_REQUEST_TYPE_LABELS[request.type]} · {formatRequestDate(request.createdAt)}
          </p>
        </div>
        <RequestStatusBadge status={request.status} />
      </div>

      {request.type === 'genel' && request.description ? (
        <p className="line-clamp-2 text-xs text-panel-text-muted">{request.description}</p>
      ) : null}

      {photoSummary(request.photoCounts) ? (
        <p className="text-xs text-panel-text-muted">{photoSummary(request.photoCounts)}</p>
      ) : null}

      {request.adminNote ? (
        <p className="rounded-lg bg-panel-blue-soft/60 px-2.5 py-1.5 text-xs text-panel-text">
          <span className="font-semibold">Yönetici notu: </span>
          {request.adminNote}
        </p>
      ) : null}
    </button>
  )
}

export default function MyRequestsPage() {
  const [requests, setRequests] = useState(null)
  const [error, setError] = useState('')
  const [detailId, setDetailId] = useState(null)
  const [creating, setCreating] = useState(false)

  const load = () => {
    getMyPanelRequests()
      .then(setRequests)
      .catch((err) => setError(err.message))
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Taleplerim"
        subtitle="Sistem yöneticilerimize ilettiğiniz talepler ve sonuçları."
        actions={
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus size={16} aria-hidden="true" />
            Talep Oluştur
          </Button>
        }
      />

      {error ? (
        <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-base text-panel-warm">{error}</div>
      ) : requests === null ? (
        <LoadingState label="Talepler yükleniyor..." />
      ) : requests.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Henüz talebiniz yok"
          description="'Talep Oluştur' ile yöneticilere bir konu iletebilir; Kitaplık ekranından ise bir kitabın sisteme eklenmesini isteyebilirsiniz."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {requests.map((request) => (
            <RequestCard key={request.id} request={request} onClick={() => setDetailId(request.id)} />
          ))}
        </div>
      )}

      {detailId ? (
        <RequestDetailModal requestId={detailId} onClose={() => setDetailId(null)} />
      ) : null}

      {creating ? (
        <GeneralRequestModal onClose={() => setCreating(false)} onSubmitted={load} />
      ) : null}
    </div>
  )
}
