import { useEffect, useState } from 'react'
import { Users, X } from 'lucide-react'
import { authRequest } from '../../../services/authClient'
import PageHeader from '../../layout/PageHeader'
import LoadingState from '../../shared/LoadingState'
import EmptyState from '../../shared/EmptyState'

const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{12,72}$/
const EMAIL_RULE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const INITIAL_FORM = {
  fullName: '',
  email: '',
  password: '',
  passwordRepeat: '',
  acceptConsent: false,
}

function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
}

function AddStudentModal({ onCreated, onClose }) {
  const [form, setForm] = useState(INITIAL_FORM)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = (event) => {
    const { name, type, value, checked } = event.target
    setForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (form.fullName.trim().length < 3) {
      setError('Ad soyad en az 3 karakter olmalı.')
      return
    }
    if (!EMAIL_RULE.test(form.email)) {
      setError('Geçerli bir e-posta adresi girin.')
      return
    }
    if (!PASSWORD_RULE.test(form.password)) {
      setError('Şifre en az 12 karakter olmalı; büyük harf, küçük harf, rakam ve özel karakter içermelidir.')
      return
    }
    if (form.password !== form.passwordRepeat) {
      setError('Şifre tekrarı eşleşmiyor.')
      return
    }
    if (!form.acceptConsent) {
      setError('Devam etmek için onay vermelisiniz.')
      return
    }

    setError('')
    setLoading(true)
    try {
      const data = await authRequest('/api/parent/students', {
        method: 'POST',
        body: JSON.stringify(form),
      })
      onCreated(data.student)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl border border-panel-border bg-panel-surface p-6"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-panel-text">Öğrenci Ekle</h2>
          <button type="button" aria-label="Kapat" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {error ? (
          <div className="mb-4 rounded-xl bg-panel-accent-soft px-4 py-3 text-sm text-panel-warm">{error}</div>
        ) : null}

        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-panel-text-muted">Ad Soyad</span>
            <input
              name="fullName"
              value={form.fullName}
              onChange={handleChange}
              className="rounded-xl border border-panel-border p-3 text-base text-panel-text"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-panel-text-muted">E-posta</span>
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              className="rounded-xl border border-panel-border p-3 text-base text-panel-text"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-panel-text-muted">Şifre</span>
            <input
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              className="rounded-xl border border-panel-border p-3 text-base text-panel-text"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-panel-text-muted">Şifre Tekrar</span>
            <input
              name="passwordRepeat"
              type="password"
              value={form.passwordRepeat}
              onChange={handleChange}
              className="rounded-xl border border-panel-border p-3 text-base text-panel-text"
            />
          </label>

          <label className="flex items-start gap-2 text-sm text-panel-text">
            <input
              type="checkbox"
              name="acceptConsent"
              checked={form.acceptConsent}
              onChange={handleChange}
              className="mt-0.5 h-5 w-5 rounded border-panel-border"
            />
            <span>Bu öğrenci için ebeveyn olarak KVKK ve aydınlatma metni onayını veriyorum.</span>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-panel-blue px-4 py-3 text-base font-semibold text-white disabled:opacity-60"
          >
            {loading ? 'Oluşturuluyor...' : 'Öğrenci Profilini Oluştur'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default function StudentsPage() {
  const [students, setStudents] = useState(null)
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)

  const loadStudents = () => {
    authRequest('/api/parent/students', { method: 'GET' })
      .then((data) => setStudents(data.students))
      .catch((err) => setError(err.message))
  }

  useEffect(() => {
    loadStudents()
  }, [])

  const handleCreated = (student) => {
    setStudents((current) => [...(current || []), student])
    setShowModal(false)
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <PageHeader
        title="Öğrenci Profillerim"
        subtitle="Hesabınıza bağlı öğrenci profillerini buradan yönetin."
        actions={
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="rounded-xl bg-panel-blue px-4 py-2.5 text-sm font-semibold text-white"
          >
            + Öğrenci Ekle
          </button>
        }
      />

      {error ? (
        <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-base text-panel-warm">{error}</div>
      ) : students === null ? (
        <LoadingState label="Öğrenciler yükleniyor..." />
      ) : students.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Henüz öğrenci profili yok"
          description="Yukarıdaki butonla ilk öğrenci profilini oluşturabilirsiniz."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {students.map((student) => (
            <div key={student.id} className="rounded-2xl border border-panel-border bg-panel-surface p-4">
              <p className="text-base font-semibold text-panel-text">{student.fullName}</p>
              <p className="text-sm text-panel-text-muted">{student.email}</p>
              <p className="mt-1 text-sm text-panel-text-muted">
                Kayıt: {formatDate(student.createdAt)} · Son giriş: {formatDate(student.lastLoginAt)}
              </p>
            </div>
          ))}
        </div>
      )}

      {showModal ? <AddStudentModal onCreated={handleCreated} onClose={() => setShowModal(false)} /> : null}
    </div>
  )
}
