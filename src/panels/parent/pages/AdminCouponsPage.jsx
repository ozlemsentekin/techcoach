import { useEffect, useState } from 'react'
import { Loader2, Plus, Tag, Trash2, X } from 'lucide-react'
import { createCoupon, deleteCoupon, getAdminCoupons, updateCoupon } from '../../../services/couponService'
import { formatTRY } from '../../../utils/pricing'
import PageHeader from '../../layout/PageHeader'
import LoadingState from '../../shared/LoadingState'
import Button from '../../ui/Button'

function CreateCouponModal({ onCreated, onClose }) {
  const [code, setCode] = useState('')
  const [discountPercent, setDiscountPercent] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!code.trim()) {
      setError('Kupon kodu girin.')
      return
    }
    const percent = Number(discountPercent)
    if (!Number.isInteger(percent) || percent < 1 || percent > 100) {
      setError('İndirim yüzdesi 1 ile 100 arasında bir tam sayı olmalı.')
      return
    }

    setError('')
    setLoading(true)
    try {
      const created = await createCoupon({
        code: code.trim(),
        discountPercent: percent,
        description: description.trim() || null,
      })
      onCreated(created)
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
          <h2 className="text-lg font-semibold text-panel-text">Yeni Kupon</h2>
          <button type="button" aria-label="Kapat" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <p className="mb-3 text-sm text-panel-text-muted">
          Kod ve yüzde oluşturulduktan sonra değiştirilemez — iyzico'da bu yüzdeye özel yeni bir
          abonelik planı oluşturulur. %100 indirim seçilse bile en az 1 TL tahsil edilir (kart
          kaydı + gelecek dönem otomatik çekimi için); indirim abonelik boyunca kalıcıdır.
        </p>

        {error ? (
          <div className="mb-3 rounded-xl bg-panel-accent-soft px-3 py-2.5 text-sm text-panel-warm">{error}</div>
        ) : null}

        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-panel-text-muted">Kupon kodu</span>
            <input
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              placeholder="Örn. YAZ2026"
              maxLength={50}
              className="rounded-xl border border-panel-border p-2.5 text-base uppercase text-panel-text"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-panel-text-muted">İndirim yüzdesi</span>
            <input
              inputMode="numeric"
              value={discountPercent}
              onChange={(event) => setDiscountPercent(event.target.value.replace(/\D/g, ''))}
              placeholder="Örn. 50"
              className="rounded-xl border border-panel-border p-2.5 text-base text-panel-text"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-panel-text-muted">Açıklama (opsiyonel)</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={2}
              maxLength={255}
              placeholder="Kullanıcıya gösterilecek kısa açıklama"
              className="rounded-xl border border-panel-border p-2.5 text-sm text-panel-text"
            />
          </label>

          <Button type="submit" disabled={loading} size="md" className="w-full">
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                iyzico planı oluşturuluyor...
              </>
            ) : (
              'Kupon Oluştur'
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState(null)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [busyId, setBusyId] = useState(null)

  useEffect(() => {
    getAdminCoupons()
      .then(setCoupons)
      .catch((err) => setError(err.message))
  }, [])

  const handleCreated = (coupon) => {
    setCoupons((current) => [coupon, ...(current || [])])
    setShowCreate(false)
  }

  const handleToggleActive = async (coupon) => {
    setError('')
    setBusyId(coupon.id)
    try {
      const updated = await updateCoupon(coupon.id, { isActive: !coupon.isActive })
      setCoupons((current) => current.map((item) => (item.id === updated.id ? updated : item)))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async (coupon) => {
    if (!window.confirm(`"${coupon.code}" kuponu kalıcı olarak silinsin mi?`)) {
      return
    }
    setError('')
    setBusyId(coupon.id)
    try {
      await deleteCoupon(coupon.id)
      setCoupons((current) => current.filter((item) => item.id !== coupon.id))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Kuponlar"
        subtitle="Veli aboneliği için yüzdelik indirim kuponları. Her kupon kendi iyzico fiyat planına bağlıdır."
        actions={
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus size={16} aria-hidden="true" />
            Yeni Kupon
          </Button>
        }
      />

      <div className="rounded-xl bg-panel-blue-soft px-4 py-3 text-sm text-panel-text">
        İndirim her yenilemede (kalıcı olarak) geçerlidir — abone olduğu andan itibaren her ay/yıl
        aynı indirimli tutar kayıtlı karttan otomatik çekilir. %100 indirim dahi ödeme adımını
        atlamaz, en az 1 TL tahsil edilir.
      </div>

      {error ? <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-base text-panel-warm">{error}</div> : null}

      {coupons === null ? (
        <LoadingState label="Kuponlar yükleniyor..." />
      ) : coupons.length === 0 ? (
        <p className="text-sm text-panel-text-muted">Henüz kupon oluşturulmadı.</p>
      ) : (
        <div className="grid gap-3">
          {coupons.map((coupon) => (
            <div key={coupon.id} className="panel-card flex flex-col gap-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-panel-blue-soft text-panel-blue">
                    <Tag size={16} aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-base font-semibold text-panel-text">
                      {coupon.code}{' '}
                      <span className="font-normal text-panel-text-muted">· %{coupon.discountPercent} indirim</span>
                    </p>
                    {coupon.description ? <p className="text-xs text-panel-text-muted">{coupon.description}</p> : null}
                  </div>
                </div>
                <span
                  className={
                    coupon.isActive
                      ? 'shrink-0 rounded-full bg-panel-green-soft px-2.5 py-1 text-xs font-medium text-panel-green'
                      : 'shrink-0 rounded-full bg-panel-surface-soft px-2.5 py-1 text-xs font-medium text-panel-text-muted'
                  }
                >
                  {coupon.isActive ? 'Aktif' : 'Pasif'}
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                <div className="rounded-xl border border-panel-border px-3 py-2">
                  <p className="text-xs text-panel-text-muted">Aylık (indirimli)</p>
                  <p className="text-base font-semibold text-panel-text">
                    {formatTRY(coupon.monthlyPrice)} <span className="text-xs font-normal text-panel-text-muted">TL</span>
                  </p>
                  <p className="text-xs text-panel-text-muted line-through">{formatTRY(coupon.baseMonthlyPrice)} TL</p>
                </div>
                {coupon.yearlyPrice != null ? (
                  <div className="rounded-xl border border-panel-border px-3 py-2">
                    <p className="text-xs text-panel-text-muted">Yıllık (indirimli)</p>
                    <p className="text-base font-semibold text-panel-text">
                      {formatTRY(coupon.yearlyPrice)} <span className="text-xs font-normal text-panel-text-muted">TL</span>
                    </p>
                    <p className="text-xs text-panel-text-muted line-through">{formatTRY(coupon.baseYearlyPrice)} TL</p>
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2 border-t border-panel-border pt-3">
                <button
                  type="button"
                  onClick={() => handleToggleActive(coupon)}
                  disabled={busyId === coupon.id}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-panel-border px-3 py-1.5 text-sm font-medium text-panel-text hover:bg-panel-surface-soft disabled:opacity-60"
                >
                  {coupon.isActive ? 'Pasife Al' : 'Aktif Et'}
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(coupon)}
                  disabled={busyId === coupon.id}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-panel-border px-3 py-1.5 text-sm font-medium text-panel-warm hover:bg-panel-accent-soft disabled:opacity-60"
                >
                  <Trash2 size={14} aria-hidden="true" />
                  Sil
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate ? <CreateCouponModal onCreated={handleCreated} onClose={() => setShowCreate(false)} /> : null}
    </div>
  )
}
