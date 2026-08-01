export default function ParentMessageCard({ message }) {
  const time = new Date(message.createdAt).toLocaleString('tr-TR', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className="panel-card p-4">
      <p className="text-sm font-medium text-panel-text-muted">
        {message.from === 'ebeveyn' ? 'Sen gönderdin' : 'Aylin gönderdi'} · {time}
      </p>
      <p className="mt-1 text-base text-panel-text">{message.text}</p>
    </div>
  )
}
