import { useState } from 'react'
import { Check, KeyRound, Loader2, X } from 'lucide-react'
import { grantParentAccess } from '../../../services/teacherService'

export default function GrantParentAccessDialog({ parent, onGranted, onClose }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  const handleConfirm = async () => {
    setSaving(true)
    setError('')
    try {
      const data = await grantParentAccess(parent.id)
      onGranted(parent.id)
      setResult(data)
    } catch (err) {
      setError(err.message || 'Panel erişimi verilemedi, tekrar deneyin.')
    } finally {
      setSaving(false)
    }
  }

  if (result) {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true">
        <div className="w-full max-w-sm rounded-t-3xl border border-panel-border bg-panel-surface p-5 shadow-lg sm:rounded-2xl sm:p-6">
          <div className="flex items-center gap-2 text-emerald-600">
            <Check size={20} aria-hidden="true" />
            <h2 className="text-lg font-semibold text-panel-text">Panel erişimi verildi</h2>
          </div>

          <div className="mt-3 flex flex-col gap-2 text-base text-panel-text-muted">
            <p>
              <strong className="text-panel-text">{parent.fullName}</strong> için geçici şifre telefon
              numarasının son 6 hanesidir:
            </p>
            <p className="rounded-xl bg-panel-blue-soft px-4 py-3 text-center text-xl font-bold tracking-widest text-panel-blue">
              {result.temporaryPassword}
            </p>
            <p>Bu bilgiyi veliye iletin; veli telefon numarası ve bu şifre ile giriş yapabilir.</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="mt-6 w-full rounded-xl bg-panel-blue px-4 py-3 text-base font-medium text-white"
          >
            Tamam
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-sm rounded-t-3xl border border-panel-border bg-panel-surface p-5 shadow-lg sm:rounded-2xl sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-panel-blue-soft text-panel-blue">
              <KeyRound size={18} aria-hidden="true" />
            </span>
            <h2 className="text-lg font-semibold text-panel-text">Panel Erişimi Ver</h2>
          </div>
          <button type="button" aria-label="Kapat" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <p className="mt-3 text-base text-panel-text-muted">
          <strong className="text-panel-text">{parent.fullName}</strong> adlı veliye panel erişimi verilecek.
          Veli telefon numarasıyla giriş yapabilecek bir hesap oluşturulur.
        </p>

        {error ? <p className="mt-3 text-sm text-panel-warm">{error}</p> : null}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 rounded-xl border border-panel-border px-4 py-3 text-base font-medium text-panel-text disabled:opacity-60"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={saving}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-panel-blue px-4 py-3 text-base font-medium text-white disabled:opacity-70"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : null}
            {saving ? 'Erişim veriliyor...' : 'Erişim Ver'}
          </button>
        </div>
      </div>
    </div>
  )
}
