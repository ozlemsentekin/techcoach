import { useEffect, useState } from 'react'
import { getMessages, sendMessage } from '../../../services/messageService'
import { getParentMessages, deactivateParentMessage } from '../../../services/motivationMessageService'
import PageHeader from '../../layout/PageHeader'
import MotivationMessageForm from '../components/MotivationMessageForm'
import LoadingState from '../../shared/LoadingState'
import EmptyState from '../../shared/EmptyState'
import Button from '../../ui/Button'
import Badge from '../../ui/Badge'
import { Card, CardContent } from '../../ui/Card'
import DataTable from '../../ui/DataTable'
import { MotionDiv } from '../../ui/motion'
import { MessageCircle } from 'lucide-react'

function formatDisplayDate(dateISO) {
  return new Date(dateISO).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })
}

function formatMessageTime(dateISO) {
  return new Date(dateISO).toLocaleString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
}

export default function MessagesPage() {
  const [messages, setMessages] = useState(null)
  const [error, setError] = useState('')
  const [text, setText] = useState('')
  const [motivationMessages, setMotivationMessages] = useState([])

  useEffect(() => {
    let ignore = false
    Promise.all([getMessages(), getParentMessages()])
      .then(([messagesData, motivationMessagesData]) => {
        if (ignore) return
        setMessages(messagesData)
        setMotivationMessages(motivationMessagesData)
      })
      .catch((err) => {
        if (!ignore) setError(err.message)
      })
    return () => {
      ignore = true
    }
  }, [])

  const handleSend = async () => {
    if (!text.trim()) return
    await sendMessage({ from: 'ebeveyn', text: text.trim() })
    setMessages(await getMessages())
    setText('')
  }

  const handleRemoveMotivationMessage = async (id) => {
    setMotivationMessages(await deactivateParentMessage(id))
  }

  const activeMotivationMessages = motivationMessages.filter((message) => message.isActive)

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Mesajlar" />

      <div className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-panel-text">Motivasyon Mesajı Gönder</h2>
        <MotivationMessageForm onSaved={async () => setMotivationMessages(await getParentMessages())} />

        {activeMotivationMessages.length > 0 ? (
          <Card className="overflow-hidden rounded-2xl border-[#e4e8e9] bg-white shadow-[0_4px_16px_rgba(37,61,62,0.06)]">
            <CardContent className="divide-y divide-[#edf0f1] p-0">
              {[...activeMotivationMessages].reverse().map((message) => (
                <div key={message.id} className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-[#f8f7fb]">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[#667475]">{formatDisplayDate(message.displayDate)}</span>
                      {message.priority === 'high' ? <Badge tone="warm">Yüksek öncelik</Badge> : null}
                    </div>
                    <p className="mt-1 text-sm text-[#253d3e]">{message.body}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveMotivationMessage(message.id)}
                    className="shrink-0 text-xs font-medium text-[#667475] hover:text-[#253d3e]"
                  >
                    Kaldır
                  </button>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}
      </div>

      <div className="flex gap-2">
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Yeni mesaj yaz"
          className="flex-1 rounded-xl border border-[#dfe4e5] p-2.5 text-base text-[#253d3e]"
        />
        <Button
          onClick={handleSend}
          className="h-10 rounded-[10px] bg-[#655e94] px-4 text-sm font-medium text-white hover:opacity-90"
        >
          Gönder
        </Button>
      </div>

      {error ? (
        <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-base text-panel-warm">{error}</div>
      ) : messages === null ? (
        <LoadingState label="Mesajlar yükleniyor..." />
      ) : messages.length === 0 ? (
        <EmptyState icon={MessageCircle} title="Henüz mesaj yok" description="İlk motivasyon mesajını gönder." />
      ) : (
        <MotionDiv initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <DataTable>
            {[...messages].reverse().map((message) => (
              <div
                key={message.id}
                className="flex items-start gap-3 border-b border-[#edf0f1] px-4 py-3 last:border-0 hover:bg-[#f8f7fb]"
              >
                <Badge tone={message.from === 'ebeveyn' ? 'blue' : 'sage'} className="shrink-0">
                  {message.from === 'ebeveyn' ? 'Sen' : 'Aylin'}
                </Badge>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-[#253d3e]">{message.text}</p>
                  <p className="mt-0.5 text-xs text-[#667475]">{formatMessageTime(message.createdAt)}</p>
                </div>
              </div>
            ))}
          </DataTable>
        </MotionDiv>
      )}
    </div>
  )
}
