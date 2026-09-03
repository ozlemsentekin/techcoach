import { useState } from 'react'
import Button from '../../ui/Button'
import { addPanelRequestMessage } from '../../../services/panelRequestService'
import { formatRequestDateTime, roleLabel } from './requestFormat'

// Bir talep üzerindeki yazışma / işlem hareketleri. Hem talep sahibi hem yönetici
// buradan not yazar. bkz. api/src/panelRequests.js addPanelRequestMessageHandler
export default function RequestMessageThread({ requestId, messages: initialMessages, onPosted }) {
  const [messages, setMessages] = useState(initialMessages || [])
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const send = async () => {
    const text = body.trim()
    if (!text) return
    setSending(true)
    setError('')
    try {
      const created = await addPanelRequestMessage(requestId, text)
      setMessages((prev) => [...prev, created])
      setBody('')
      onPosted?.(created)
    } catch (err) {
      setError(err.message || 'Not eklenemedi.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-semibold text-panel-text">İşlem hareketleri</p>

      {messages.length === 0 ? (
        <p className="text-sm text-panel-text-muted">
          Henüz not yok. Aşağıdan yönetici ile yazışabilirsiniz.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {messages.map((message) => {
            const admin = message.authorRole === 'admin'
            return (
              <li
                key={message.id}
                className={`flex flex-col gap-1 rounded-xl border px-3 py-2 text-sm ${
                  admin
                    ? 'border-panel-blue/25 bg-panel-blue-soft/50'
                    : 'border-panel-border bg-panel-surface'
                }`}
              >
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-panel-text-muted">
                  <span className="font-semibold text-panel-text">
                    {message.authorName || 'Kullanıcı'}
                  </span>
                  <span>· {admin ? 'Yönetici' : roleLabel(message.authorRole)}</span>
                  <span>· {formatRequestDateTime(message.createdAt)}</span>
                </div>
                <p className="whitespace-pre-wrap text-panel-text">{message.body}</p>
              </li>
            )
          })}
        </ul>
      )}

      {error ? <p className="text-sm text-panel-warm">{error}</p> : null}

      <div className="flex flex-col gap-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="Bir not yazın..."
          className="rounded-xl border border-panel-border p-2.5 text-sm text-panel-text"
        />
        <div className="flex justify-end">
          <Button size="sm" onClick={send} disabled={sending || !body.trim()}>
            {sending ? 'Gönderiliyor...' : 'Not Ekle'}
          </Button>
        </div>
      </div>
    </div>
  )
}
