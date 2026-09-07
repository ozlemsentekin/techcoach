import { useEffect, useState } from 'react'
import { Pencil, RefreshCw, Tag, X } from 'lucide-react'
import {
  getAdminPricingPlans,
  refreshIyzicoPlan,
  updatePricingPlan,
} from '../../../services/pricingService'
import { formatTRY } from '../../../utils/pricing'
import PageHeader from '../../layout/PageHeader'
import LoadingState from '../../shared/LoadingState'
import Button from '../../ui/Button'

const PLAN_HINTS = {
  parent: 'Kayıt sayfası ve ödeme sayfasındaki "Veli Takip Paketi" kartı.',
  teacher: 'Kayıt sayfasındaki "Öğretmen İş Paketi" kartı. "ek öğrenci ... TL / ay" satırını özellik listesinden elle güncelleyin.',
  teacher_seat: 'Öğretmen paneli "Ek Öğrenci Paketi" satın alma modalı.',
  child_seat: 'Veli paneli "Ek Çocuk Paketi" satın alma modalı.',
}

function PlanModal({ plan, onSaved, onClose }) {
  const [title, setTitle] = useState(plan.title || '')
  const [monthlyPrice, setMonthlyPrice] = useState(String(plan.monthlyPrice ?? ''))
  const [yearlyPrice, setYearlyPrice] = useState(plan.yearlyPrice == null ? '' : String(plan.yearlyPrice))
  const [yearlyBadge, setYearlyBadge] = useState(plan.yearlyBadge || '')
  const [features, setFeatures] = useState((plan.features || []).join('\n'))
  const [note, setNote] = useState(plan.note || '')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()

    const monthly = Number(monthlyPrice)
    if (!Number.isInteger(monthly) || monthly < 0) {
      setError('Aylık fiyat 0 veya daha büyük bir tam sayı olmalı.')
      return
    }
    const yearly = yearlyPrice.trim() === '' ? null : Number(yearlyPrice)
    if (yearly !== null && (!Number.isInteger(yearly) || yearly < 0)) {
      setError('Yıllık fiyat boş bırakılabilir ya da 0 veya daha büyük bir tam sayı olmalı.')
      return
    }

    setError('')
    setLoading(true)
    try {
      const saved = await updatePricingPlan(plan.planKey, {
        title: title.trim(),
        monthlyPrice: monthly,
        yearlyPrice: yearly,
        yearlyBadge: yearlyBadge.trim() || null,
        features: features
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean),
        note: note.trim() || null,
      })
      onSaved(saved)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-0 sm:items-center sm:p-4">
      <form
        onSubmit={handleSubmit}
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-panel-border bg-panel-surface p-5 shadow-panel-1 sm:rounded-2xl"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-panel-text">Paketi Düzenle</h2>
          <button type="button" aria-label="Kapat" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {PLAN_HINTS[plan.planKey] ? (
          <p className="mb-3 text-sm text-panel-text-muted">{PLAN_HINTS[plan.planKey]}</p>
        ) : null}

        {error ? (
          <div className="mb-3 rounded-xl bg-panel-accent-soft px-3 py-2.5 text-sm text-panel-warm">{error}</div>
        ) : null}

        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-panel-text-muted">Başlık</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="rounded-xl border border-panel-border p-2.5 text-base text-panel-text"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-panel-text-muted">Aylık fiyat (TL)</span>
              <input
                inputMode="numeric"
                value={monthlyPrice}
                onChange={(event) => setMonthlyPrice(event.target.value.replace(/\D/g, ''))}
                className="rounded-xl border border-panel-border p-2.5 text-base text-panel-text"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-panel-text-muted">Yıllık fiyat (TL)</span>
              <input
                inputMode="numeric"
                value={yearlyPrice}
                onChange={(event) => setYearlyPrice(event.target.value.replace(/\D/g, ''))}
                placeholder="Yıllık yoksa boş bırakın"
                className="rounded-xl border border-panel-border p-2.5 text-base text-panel-text"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-panel-text-muted">Yıllık rozet (opsiyonel)</span>
            <input
              value={yearlyBadge}
              onChange={(event) => setYearlyBadge(event.target.value)}
              placeholder="Örn. %20 indirim"
              maxLength={60}
              className="rounded-xl border border-panel-border p-2.5 text-base text-panel-text"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-panel-text-muted">Özellikler (her satır bir madde)</span>
            <textarea
              value={features}
              onChange={(event) => setFeatures(event.target.value)}
              rows={6}
              className="rounded-xl border border-panel-border p-2.5 text-sm text-panel-text"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-panel-text-muted">Not (opsiyonel)</span>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={2}
              maxLength={400}
              className="rounded-xl border border-panel-border p-2.5 text-sm text-panel-text"
            />
          </label>

          <Button type="submit" disabled={loading} size="md" className="w-full">
            {loading ? 'Kaydediliyor...' : 'Kaydet'}
          </Button>
        </div>
      </form>
    </div>
  )
}

function IyzicoResultModal({ result, onClose }) {
  const lines = result.settings.map((item) => `${item.key}=${item.referenceCode}`).join('\n')

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-0 sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-panel-border bg-panel-surface p-5 shadow-panel-1 sm:rounded-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-panel-text">iyzico planı oluşturuldu</h2>
          <button type="button" aria-label="Kapat" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <p className="mb-3 text-sm text-panel-text-muted">
          Yeni iyzico fiyat planı oluşturuldu. Canlı tahsilatın yeni fiyattan yapılması için aşağıdaki
          satırları <strong>Azure Portal → Static Web App → Configuration (API)</strong> altına
          yazıp uygulamayı yeniden başlatın. Mevcut aboneler eski planlarında kalır.
        </p>

        <pre className="mb-3 overflow-x-auto whitespace-pre rounded-xl bg-panel-surface-soft p-3 text-xs text-panel-text">{lines}</pre>

        <div className="text-xs text-panel-text-muted">Ürün referans kodu: {result.productReferenceCode}</div>

        <Button size="md" className="mt-4 w-full" onClick={onClose}>
          Tamam
        </Button>
      </div>
    </div>
  )
}

function PriceTag({ label, value, period }) {
  return (
    <div className="rounded-xl border border-panel-border px-3 py-2">
      <p className="text-xs text-panel-text-muted">{label}</p>
      <p className="text-base font-semibold text-panel-text">
        {value} <span className="text-xs font-normal text-panel-text-muted">{period}</span>
      </p>
    </div>
  )
}

export default function AdminPricingPage() {
  const [plans, setPlans] = useState(null)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null)
  const [iyzicoBusy, setIyzicoBusy] = useState(null)
  const [iyzicoResult, setIyzicoResult] = useState(null)

  useEffect(() => {
    getAdminPricingPlans()
      .then(setPlans)
      .catch((err) => setError(err.message))
  }, [])

  const handleSaved = (saved) => {
    setPlans((current) => (current || []).map((item) => (item.planKey === saved.planKey ? saved : item)))
    setEditing(null)
  }

  const handleIyzicoRefresh = async (plan) => {
    const confirmed = window.confirm(
      `"${plan.title}" için iyzico'da ${formatTRY(plan.monthlyPrice)} TL aylık` +
        `${plan.yearlyPrice != null ? ` / ${formatTRY(plan.yearlyPrice)} TL yıllık` : ''} yeni bir fiyat planı oluşturulacak.\n\n` +
        'Dönen referans kodlarını Azure App Settings\'e yazana kadar canlı tahsilat değişmez. Devam edilsin mi?',
    )
    if (!confirmed) {
      return
    }
    setError('')
    setIyzicoBusy(plan.planKey)
    try {
      const data = await refreshIyzicoPlan(plan.planKey)
      setIyzicoResult({ ...data, planKey: plan.planKey })
    } catch (err) {
      setError(err.message)
    } finally {
      setIyzicoBusy(null)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Üyelik Paketleri"
        subtitle="Kayıt, ödeme ve koltuk satın alma ekranlarında görünen fiyatlar ve metinler."
      />

      <div className="rounded-xl bg-panel-blue-soft px-4 py-3 text-sm text-panel-text">
        Buradaki değerler yalnızca <strong>görünen</strong> fiyatı belirler. iyzico'da fiilen tahsil
        edilen tutar iyzico abonelik planlarına bağlıdır; tutarı kalıcı değiştirmek için yeni iyzico
        planı oluşturup referans kodunu güncellemek gerekir.
      </div>

      {error ? (
        <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-base text-panel-warm">{error}</div>
      ) : plans === null ? (
        <LoadingState label="Paketler yükleniyor..." />
      ) : (
        <div className="grid gap-3">
          {plans.map((plan) => (
            <div key={plan.planKey} className="panel-card flex flex-col gap-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-panel-blue-soft text-panel-blue">
                    <Tag size={16} aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-base font-semibold text-panel-text">{plan.title}</p>
                    <p className="text-xs text-panel-text-muted">{PLAN_HINTS[plan.planKey]}</p>
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Paketi düzenle"
                  onClick={() => setEditing(plan)}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-panel-border text-panel-text-muted hover:bg-panel-surface-soft hover:text-panel-text"
                >
                  <Pencil size={15} aria-hidden="true" />
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                <PriceTag label="Aylık" value={formatTRY(plan.monthlyPrice)} period="TL" />
                {plan.yearlyPrice != null ? (
                  <PriceTag
                    label={`Yıllık${plan.yearlyBadge ? ` · ${plan.yearlyBadge}` : ''}`}
                    value={formatTRY(plan.yearlyPrice)}
                    period="TL"
                  />
                ) : null}
              </div>

              {plan.features.length ? (
                <ul className="flex flex-col gap-1 text-sm text-panel-text-muted">
                  {plan.features.map((feature) => (
                    <li key={feature}>• {feature}</li>
                  ))}
                </ul>
              ) : null}

              {plan.note ? <p className="text-xs italic text-panel-text-muted">{plan.note}</p> : null}

              {plan.iyzicoManaged ? (
                <div className="flex flex-wrap items-center gap-2 border-t border-panel-border pt-3">
                  <button
                    type="button"
                    onClick={() => handleIyzicoRefresh(plan)}
                    disabled={iyzicoBusy === plan.planKey}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-panel-border px-3 py-1.5 text-sm font-medium text-panel-text hover:bg-panel-surface-soft disabled:opacity-60"
                  >
                    <RefreshCw size={14} aria-hidden="true" className={iyzicoBusy === plan.planKey ? 'animate-spin' : ''} />
                    {iyzicoBusy === plan.planKey ? 'iyzico planı oluşturuluyor...' : 'iyzico planını bu fiyatla yenile'}
                  </button>
                  <span className="text-xs text-panel-text-muted">
                    Canlı tahsilatı yeni fiyata almak için gerekli
                  </span>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {editing ? <PlanModal plan={editing} onSaved={handleSaved} onClose={() => setEditing(null)} /> : null}
      {iyzicoResult ? (
        <IyzicoResultModal result={iyzicoResult} onClose={() => setIyzicoResult(null)} />
      ) : null}
    </div>
  )
}
