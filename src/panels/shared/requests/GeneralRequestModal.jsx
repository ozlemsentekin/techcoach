import { useState } from 'react'
import { Check, X } from 'lucide-react'
import Button from '../../ui/Button'
import { createGeneralPanelRequest } from '../../../services/panelRequestService'

// "Talep Oluştur" akışı: serbest konu + açıklama ile yöneticilere genel talep gönderir.
// Sonuç "Taleplerim" menüsünden takip edilir; talep üzerinde yönetici ile karşılıklı not
// yazışılır. bkz. api/src/panelRequests.js
export default function GeneralRequestModal({ onClose, onSubmitted }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  const canSubmit = title.trim().length >= 3 && description.trim().length >= 3

  const handleSubmit = async () => {
    if (!canSubmit) {
      setError('Konu ve açıklama en az 3 karakter olmalı.')
      return
    }
    setError('')
    setSubmitting(true)
    try {
      const created = await createGeneralPanelRequest({
        title: title.trim(),
        description: description.trim(),
      })
      setDone(true)
      onSubmitted?.(created)
    } catch (err) {
      setError(err.message || 'Talep gönderilemedi.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/30 p-0 sm:items-center sm:p-4">
      <div className="flex h-full w-full flex-col overflow-hidden border border-panel-border bg-panel-surface shadow-panel-1 sm:h-auto sm:max-h-[92vh] sm:max-w-lg sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-panel-border p-4 sm:p-5">
          <div>
            <h2 className="text-lg font-bold text-panel-text">Talep Oluştur</h2>
            <p className="mt-0.5 text-sm text-panel-text-muted">
              {done ? 'Talebiniz alındı.' : 'Konu ve açıklamayı yazın, yöneticilere iletelim.'}
            </p>
          </div>
          <button
            type="button"
            aria-label="Kapat"
            onClick={onClose}
            className="shrink-0 text-panel-text-muted hover:text-panel-text"
          >
            <X size={20} />
          </button>
        </div>

        {done ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-panel-sage-soft text-panel-sage">
              <Check size={28} aria-hidden="true" />
            </span>
            <div>
              <p className="text-base font-semibold text-panel-text">Talebiniz alındı</p>
              <p className="mx-auto mt-1.5 max-w-sm text-sm text-panel-text-muted">
                Talebiniz sistem yöneticilerimize iletildi. Gelişmeleri ve yöneticinin
                yanıtlarını <strong>Taleplerim</strong> menüsünden takip edebilir, talep
                üzerine not yazabilirsiniz.
              </p>
            </div>
            <Button onClick={onClose}>Kapat</Button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-4 sm:p-5">
              {error ? (
                <div className="mb-3 rounded-xl bg-panel-accent-soft px-3 py-2 text-sm text-panel-warm">
                  {error}
                </div>
              ) : null}

              <div className="flex flex-col gap-4">
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-panel-text-muted">Konu</span>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={200}
                    placeholder="Talebinizi bir cümleyle özetleyin"
                    className="rounded-xl border border-panel-border p-2.5 text-base text-panel-text"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-panel-text-muted">Açıklama</span>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={6}
                    maxLength={2000}
                    placeholder="Talebinizin ayrıntılarını yazın."
                    className="rounded-xl border border-panel-border p-2.5 text-base text-panel-text"
                  />
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-panel-border p-4 sm:p-5">
              <Button variant="ghost" onClick={onClose} disabled={submitting}>
                Vazgeç
              </Button>
              <Button onClick={handleSubmit} disabled={submitting || !canSubmit}>
                {submitting ? 'Gönderiliyor...' : 'Talebi Gönder'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
