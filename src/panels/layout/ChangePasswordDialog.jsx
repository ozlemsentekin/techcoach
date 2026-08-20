import { useState } from 'react'
import { Check, Eye, EyeOff, KeyRound, Loader2, X } from 'lucide-react'
import { authRequest } from '../../services/authClient'

function PasswordField({ label, value, onChange, autoComplete, visible, onToggleVisible }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-panel-text">{label}</span>
      <span className="relative flex items-center">
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          className="w-full rounded-xl border border-panel-border px-3 py-2.5 pr-10 text-base text-panel-text"
        />
        <button
          type="button"
          onClick={onToggleVisible}
          aria-label={visible ? 'Şifreyi gizle' : 'Şifreyi göster'}
          className="absolute right-2.5 text-panel-text-muted hover:text-panel-text"
        >
          {visible ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
        </button>
      </span>
    </label>
  )
}

export default function ChangePasswordDialog({ onClose }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPasswords, setShowPasswords] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    if (newPassword.length < 6) {
      setError('Yeni şifre en az 6 karakter olmalı.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Yeni şifre ile tekrar aynı olmalı.')
      return
    }

    setSaving(true)
    try {
      await authRequest('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      setSuccess(true)
    } catch (err) {
      setError(err.message || 'Şifre değiştirilemedi, tekrar deneyin.')
    } finally {
      setSaving(false)
    }
  }

  if (success) {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true">
        <div className="w-full max-w-sm rounded-t-3xl border border-panel-border bg-panel-surface p-5 shadow-lg sm:rounded-2xl sm:p-6">
          <div className="flex items-center gap-2 text-emerald-600">
            <Check size={20} aria-hidden="true" />
            <h2 className="text-lg font-semibold text-panel-text">Şifre değiştirildi</h2>
          </div>
          <p className="mt-3 text-base text-panel-text-muted">
            Yeni şifren kaydedildi, bir sonraki girişte bu şifreyi kullanabilirsin.
          </p>
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
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-t-3xl border border-panel-border bg-panel-surface p-5 shadow-lg sm:rounded-2xl sm:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-panel-blue-soft text-panel-blue">
              <KeyRound size={18} aria-hidden="true" />
            </span>
            <h2 className="text-lg font-semibold text-panel-text">Şifremi Değiştir</h2>
          </div>
          <button type="button" aria-label="Kapat" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-3">
          <PasswordField
            label="Mevcut şifre"
            value={currentPassword}
            onChange={setCurrentPassword}
            autoComplete="current-password"
            visible={showPasswords}
            onToggleVisible={() => setShowPasswords((value) => !value)}
          />
          <PasswordField
            label="Yeni şifre"
            value={newPassword}
            onChange={setNewPassword}
            autoComplete="new-password"
            visible={showPasswords}
            onToggleVisible={() => setShowPasswords((value) => !value)}
          />
          <PasswordField
            label="Yeni şifre (tekrar)"
            value={confirmPassword}
            onChange={setConfirmPassword}
            autoComplete="new-password"
            visible={showPasswords}
            onToggleVisible={() => setShowPasswords((value) => !value)}
          />
        </div>

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
            type="submit"
            disabled={saving}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-panel-blue px-4 py-3 text-base font-medium text-white disabled:opacity-70"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : null}
            {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </form>
    </div>
  )
}
