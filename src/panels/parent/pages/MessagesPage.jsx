import { useState } from 'react'
import { getMessages, sendMessage } from '../../../services/messageService'
import PageHeader from '../../layout/PageHeader'
import ParentMessageCard from '../components/ParentMessageCard'
import EmptyState from '../../shared/EmptyState'
import { MessageCircle } from 'lucide-react'

export default function MessagesPage() {
  const [messages, setMessages] = useState(() => getMessages())
  const [text, setText] = useState('')

  const handleSend = () => {
    if (!text.trim()) return
    sendMessage({ from: 'ebeveyn', text: text.trim() })
    setMessages(getMessages())
    setText('')
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <PageHeader title="Mesajlar" subtitle="Aylin ile aranızdaki motivasyon mesajları." />

      <div className="flex gap-2">
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Yeni mesaj yaz"
          className="flex-1 rounded-xl border border-panel-border p-3 text-base text-panel-text"
        />
        <button
          type="button"
          onClick={handleSend}
          className="rounded-xl bg-panel-blue px-4 py-3 text-base font-semibold text-white"
        >
          Gönder
        </button>
      </div>

      {messages.length === 0 ? (
        <EmptyState icon={MessageCircle} title="Henüz mesaj yok" description="İlk motivasyon mesajını gönder." />
      ) : (
        <div className="flex flex-col gap-2">
          {[...messages].reverse().map((message) => (
            <ParentMessageCard key={message.id} message={message} />
          ))}
        </div>
      )}
    </div>
  )
}
