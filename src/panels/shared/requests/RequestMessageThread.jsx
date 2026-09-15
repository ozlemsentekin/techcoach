import { useState } from 'react'
import Button from '../../ui/Button'
import { addPanelRequestMessage } from '../../../services/panelRequestService'
import { formatMessageTime, roleLabel } from './requestFormat'

// Bir talep üzerindeki yazışma / işlem hareketleri. Hem talep sahibi hem yönetici
// buradan not yazar. Sohbet balonu görünümü: `viewerIsAdmin` görüntüleyenin hangi
// taraf olduğunu belirler, kendi mesajları sağda gösterilir.
// bkz. api/src/panelRequests.js addPanelRequestMessageHandler
export default function RequestMessageThread({ requestId, messages: initialMessages, viewerIsAdmin, onPosted }) {
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
      <p className="text-sm font-semibold text-panel-text">Yazışma</p>

      {messages.length === 0 ? (
        <p className="text-sm text-panel-text-muted">
          Henüz not yok. Aşağıdan yönetici ile yazışabilirsiniz.
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {messages.map((message) => {
            const admin = message.authorRole === 'admin'
            const isOwn = viewerIsAdmin ? admin : !admin
            return (
              <li key={message.id} className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                    isOwn
                      ? 'rounded-br-sm bg-panel-blue text-white'
                      : 'rounded-bl-sm bg-panel-surface-soft text-panel-text'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{message.body}</p>
                </div>
                <span className="mt-1 px-1 text-[11px] text-panel-text-muted">
                  {message.authorName || (admin ? 'Yönetici' : roleLabel(message.authorRole))}
                  {' · '}
                  {formatMessageTime(message.createdAt)}
                </span>
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
          rows={2}
          maxLength={2000}
          placeholder="Bir mesaj yaz..."
          className="rounded-xl border border-panel-border p-2.5 text-sm text-panel-text"
        />
        <div className="flex justify-end">
          <Button size="sm" onClick={send} disabled={sending || !body.trim()}>
            {sending ? 'Gönderiliyor...' : 'Gönder'}
          </Button>
        </div>
      </div>
    </div>
  )
}
