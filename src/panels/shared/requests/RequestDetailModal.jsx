import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import LoadingState from '../LoadingState'
import { authRequest } from '../../../services/authClient'
import { getPanelRequest, PANEL_REQUEST_TYPE_LABELS } from '../../../services/panelRequestService'
import { formatRequestDate, roleLabel } from './requestFormat'
import { PhotoGrid, RequestStatusBadge } from './requestPresentation'

function InfoRow({ label, value }) {
  if (!value) return null
  return (
    <div className="flex gap-2 text-sm">
      <span className="w-24 shrink-0 text-panel-text-muted">{label}</span>
      <span className="text-panel-text">{value}</span>
    </div>
  )
}

/**
 * Bir talebin tüm ayrıntısı (bilgiler + fotoğraflar). `renderActions` verilirse (admin
 * "Kitap Talepleri" ekranı) footer'da aksiyonlar gösterilir.
 */
export default function RequestDetailModal({ requestId, showRequester = false, renderActions, onClose }) {
  const [detail, setDetail] = useState(null)
  const [subjects, setSubjects] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    let ignore = false
    Promise.all([
      getPanelRequest(requestId),
      authRequest('/api/panel/subjects', { method: 'GET' }).catch(() => ({ subjects: [] })),
    ])
      .then(([data, subjectsData]) => {
        if (ignore) return
        setDetail(data)
        setSubjects(subjectsData.subjects || [])
      })
      .catch((err) => {
        if (!ignore) setError(err.message)
      })
    return () => {
      ignore = true
    }
  }, [requestId])

  const book = detail?.book || {}
  const subjectName = subjects.find((subject) => subject.id === book.subjectId)?.name || null

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/30 p-0 sm:items-center sm:p-4">
      <div className="flex h-full w-full flex-col overflow-hidden border border-panel-border bg-panel-surface shadow-panel-1 sm:h-auto sm:max-h-[92vh] sm:max-w-2xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-panel-border p-4 sm:p-5">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-panel-text">
              {PANEL_REQUEST_TYPE_LABELS[detail?.type] || 'Talep'}
            </h2>
            {detail ? (
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-panel-text-muted">
                <RequestStatusBadge status={detail.status} />
                <span>{formatRequestDate(detail.createdAt)}</span>
              </div>
            ) : null}
          </div>
          <button type="button" aria-label="Kapat" onClick={onClose} className="shrink-0 text-panel-text-muted hover:text-panel-text">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {error ? (
            <div className="rounded-xl bg-panel-accent-soft px-3 py-2 text-sm text-panel-warm">{error}</div>
          ) : !detail ? (
            <LoadingState label="Talep yükleniyor..." />
          ) : (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5 rounded-xl border border-panel-border p-3">
                {showRequester ? (
                  <InfoRow
                    label="Talep eden"
                    value={[detail.requesterName, roleLabel(detail.createdByRole)].filter(Boolean).join(' · ')}
                  />
                ) : null}
                <InfoRow label="Kitap adı" value={book.bookName} />
                <InfoRow label="Yayınevi" value={book.publisherName} />
                <InfoRow label="Ders" value={subjectName} />
                <InfoRow label="Sınıf" value={book.grade ? `${book.grade}. sınıf` : null} />
                <InfoRow label="Not" value={book.note} />
                {!book.bookName && !book.publisherName && !book.grade && !book.note ? (
                  <p className="text-sm text-panel-text-muted">Ek bilgi girilmemiş — fotoğraflara bakın.</p>
                ) : null}
              </div>

              {detail.adminNote ? (
                <div className="rounded-xl bg-panel-blue-soft/60 px-3 py-2.5 text-sm text-panel-text">
                  <span className="font-semibold">Yönetici notu: </span>
                  {detail.adminNote}
                </div>
              ) : null}

              <PhotoGrid title="Kapak" photos={detail.photos?.kapak} />
              <PhotoGrid title="İçindekiler" photos={detail.photos?.icindekiler} />
              <PhotoGrid title="Cevap anahtarı" photos={detail.photos?.cevapAnahtari} />
            </div>
          )}
        </div>

        {detail && renderActions ? (
          <div className="border-t border-panel-border p-4 sm:p-5">{renderActions(detail)}</div>
        ) : null}
      </div>
    </div>
  )
}
