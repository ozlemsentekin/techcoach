const STATUS_LABELS = {
  bekliyor: 'Bekliyor',
  onaylandi: 'Onaylandı',
  reddedildi: 'Başka saat önerildi',
  ertelendi: 'Ertelendi',
}

export default function StudentRequestsCard({ requests, onApprove, onMessage, onSuggestOther, onPostpone }) {
  const pending = requests.filter((request) => request.status === 'bekliyor')
  const resolved = requests.filter((request) => request.status !== 'bekliyor')

  return (
    <div className="rounded-2xl border border-panel-border bg-panel-surface p-5">
      <h2 className="text-base font-semibold text-panel-text">Aylin'in Talepleri</h2>

      {pending.length === 0 ? (
        <p className="mt-2 text-sm text-panel-text-muted">Şu an bekleyen bir talep yok.</p>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          {pending.map((request) => (
            <div key={request.id} className="rounded-xl border border-panel-border p-3">
              <p className="text-base text-panel-text">{request.message}</p>
              <p className="mt-1 text-xs text-panel-text-muted">
                {new Date(request.createdAt).toLocaleString('tr-TR', {
                  day: 'numeric',
                  month: 'long',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
              <div className="mt-2 flex flex-wrap gap-2 text-sm">
                <button type="button" onClick={() => onApprove(request)} className="text-panel-sage hover:underline">
                  Onayla
                </button>
                <button type="button" onClick={() => onMessage(request)} className="text-panel-blue hover:underline">
                  Mesaj Gönder
                </button>
                <button
                  type="button"
                  onClick={() => onSuggestOther(request)}
                  className="text-panel-blue hover:underline"
                >
                  Başka Saat Öner
                </button>
                <button
                  type="button"
                  onClick={() => onPostpone(request)}
                  className="text-panel-text-muted hover:underline"
                >
                  Ertele
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {resolved.length > 0 ? (
        <div className="mt-3 flex flex-col gap-1">
          {resolved.map((request) => (
            <p key={request.id} className="text-xs text-panel-text-muted">
              {request.message} · {STATUS_LABELS[request.status]}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  )
}
