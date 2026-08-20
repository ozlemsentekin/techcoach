import { useState } from 'react'
import { Check, KeyRound, Loader2, X } from 'lucide-react'
import { authRequest } from '../../../services/authClient'

export default function GrantTeacherAccessDialog({ teacher, associationCount, onGranted, onClose }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  const handleConfirm = async () => {
    setSaving(true)
    setError('')
    try {
      const data = await authRequest(
        `/api/parent/students/${teacher.studentId}/teachers/${teacher.id}/grant-access`,
        { method: 'POST' },
      )
      onGranted(data.teachers)
      setResult(data)
    } catch (err) {
      setError(err.message || 'Panel yetkisi verilemedi, tekrar deneyin.')
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
            <h2 className="text-lg font-semibold text-panel-text">Panel yetkisi verildi</h2>
          </div>

          {result.isNewAccount ? (
            <div className="mt-3 flex flex-col gap-2 text-base text-panel-text-muted">
              <p>
                <strong className="text-panel-text">{teacher.fullName}</strong> için yeni bir öğretmen hesabı
                oluşturuldu. Geçici şifre telefon numarasının son 6 hanesidir:
              </p>
              <p className="rounded-xl bg-panel-blue-soft px-4 py-3 text-center text-xl font-bold tracking-widest text-panel-blue">
                {result.temporaryPassword}
              </p>
              <p>Bu bilgiyi öğretmenle paylaşın; öğretmen telefon numarası ve bu şifre ile giriş yapabilir.</p>
            </div>
          ) : (
            <p className="mt-3 text-base text-panel-text-muted">
              {teacher.fullName} zaten sistemde kayıtlı bir öğretmen hesabına sahip; öğrenci bu hesaba bağlandı.
            </p>
          )}

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
            <h2 className="text-lg font-semibold text-panel-text">Panele Yetki Ver</h2>
          </div>
          <button type="button" aria-label="Kapat" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <p className="mt-3 text-base text-panel-text-muted">
          <strong className="text-panel-text">{teacher.fullName}</strong> adlı öğretmene panel erişimi verilecek.{' '}
          {associationCount > 1
            ? `Bu öğretmene bağlı ${associationCount} öğrenci-ders ilişkisinin tamamı yetkilendirilecek.`
            : 'Bu öğrenci-ders ilişkisi yetkilendirilecek.'}{' '}
          Öğretmenin telefon numarasıyla sistemde hesabı yoksa otomatik olarak oluşturulur.
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
            {saving ? 'Yetki veriliyor...' : 'Yetki Ver'}
          </button>
        </div>
      </div>
    </div>
  )
}
