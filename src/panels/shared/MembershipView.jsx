import { useEffect, useState } from 'react'
import { AlertTriangle, CalendarClock, Users } from 'lucide-react'
import PageHeader from '../layout/PageHeader'
import LoadingState from './LoadingState'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import ConfirmationDialog from './ConfirmationDialog'
import { formatRequestDate } from './requests/requestFormat'
import { formatTRY } from '../../utils/pricing'
import {
  getParentMembership,
  cancelParentMembership,
  getTeacherMembership,
  cancelTeacherMembership,
} from '../../services/membershipService'

const STATUS_LABELS = {
  active: 'Aktif',
  trial: 'Deneme',
  grace_period: 'Ödeme Gecikti',
  cancelled: 'İptal Edildi',
  expired: 'Süresi Doldu',
  none: 'Abonelik Yok',
}

const STATUS_TONES = {
  active: 'sage',
  trial: 'blue',
  grace_period: 'yellow',
  cancelled: 'red',
  expired: 'red',
  none: 'neutral',
}

const ORDER_STATUS_LABELS = {
  SUCCESS: 'Ödeme Alındı',
  PAID: 'Ödeme Alındı',
  FAILED: 'Ödeme Başarısız',
  FAILURE: 'Ödeme Başarısız',
  PENDING: 'Bekliyor',
  WAITING: 'Bekliyor',
}

const ORDER_STATUS_TONES = {
  SUCCESS: 'sage',
  PAID: 'sage',
  FAILED: 'red',
  FAILURE: 'red',
  PENDING: 'yellow',
  WAITING: 'yellow',
}

function StatusBadge({ status }) {
  return <Badge tone={STATUS_TONES[status] || 'neutral'}>{STATUS_LABELS[status] || status || 'Bilinmiyor'}</Badge>
}

function periodLabel(period) {
  if (period === 'monthly') return 'Aylık'
  if (period === 'yearly') return 'Yıllık'
  return null
}

function planPriceLabel(monthlyPrice, yearlyPrice, period) {
  const price = period === 'yearly' ? yearlyPrice : monthlyPrice
  if (price == null) return null
  const label = periodLabel(period)
  return `₺${formatTRY(price)}${label ? ` / ${label}` : ''}`
}

// Veli/öğretmen panelinde "Üyelik Bilgilerim" sayfası: mevcut abonelik durumu, ek koltuklar,
// iyzico'dan canlı çekilen hesap hareketleri ve self-service iptal. Backend: api/src/membership.js.
export default function MembershipView({ role }) {
  const isTeacher = role === 'teacher'
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelLoading, setCancelLoading] = useState(false)
  const [cancelError, setCancelError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let ignore = false
    setLoading(true)
    setError('')
    const fetcher = isTeacher ? getTeacherMembership : getParentMembership
    fetcher()
      .then((result) => {
        if (!ignore) setData(result)
      })
      .catch((err) => {
        if (!ignore) setError(err.message || 'Üyelik bilgileri alınamadı.')
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [isTeacher])

  const reload = () => {
    const fetcher = isTeacher ? getTeacherMembership : getParentMembership
    fetcher().then(setData).catch(() => {})
  }

  const handleCancel = async () => {
    setCancelLoading(true)
    setCancelError('')
    try {
      const result = await (isTeacher ? cancelTeacherMembership() : cancelParentMembership())
      setCancelOpen(false)
      setNotice(
        result?.subscriptionWarning ||
          "İptal talebiniz iyzico'ya iletildi. Panele yansıması birkaç dakika sürebilir.",
      )
      reload()
    } catch (err) {
      setCancelError(err.message || 'Üyelik iptal edilemedi.')
    } finally {
      setCancelLoading(false)
    }
  }

  if (loading) {
    return <LoadingState label="Üyelik bilgileri yükleniyor..." />
  }

  if (error) {
    return (
      <div className="flex w-full flex-col gap-5">
        <PageHeader title="Üyelik Bilgilerim" />
        <div className="panel-card p-5 text-sm text-panel-red">{error}</div>
      </div>
    )
  }

  const membership = data?.membership
  const seats = isTeacher ? data?.seats || [] : data?.childSeats || []
  const seatsLabel = isTeacher ? 'Ek Öğrenci Koltukları' : 'Ek Çocuk Koltukları'
  const quota = data?.quota
  const fallbackTitle = isTeacher ? 'Öğretmen İş Paketi' : 'Veli Takip Paketi'
  const priceLabel = membership
    ? isTeacher
      ? planPriceLabel(membership.monthlyPrice, null, 'monthly')
      : planPriceLabel(membership.monthlyPrice, membership.yearlyPrice, membership.period)
    : null

  return (
    <div className="flex w-full flex-col gap-5">
      <PageHeader title="Üyelik Bilgilerim" subtitle="Abonelik durumunuzu görüntüleyin ve yönetin." />

      {notice ? <div className="rounded-xl bg-panel-sage-soft px-4 py-3 text-sm text-panel-sage">{notice}</div> : null}

      <div className="panel-card flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-panel-text-muted">{isTeacher ? 'Öğretmen Paketi' : 'Veli Paketi'}</p>
            <p className="mt-1 text-lg font-bold text-panel-text">{membership?.planTitle || fallbackTitle}</p>
          </div>
          <StatusBadge status={membership?.status || 'none'} />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {priceLabel ? (
            <div className="flex items-center gap-2 text-sm text-panel-text">
              <CalendarClock size={16} className="shrink-0 text-panel-text-muted" aria-hidden="true" />
              {priceLabel}
            </div>
          ) : null}
          {membership?.currentPeriodEnd ? (
            <div className="flex items-center gap-2 text-sm text-panel-text">
              <CalendarClock size={16} className="shrink-0 text-panel-text-muted" aria-hidden="true" />
              Dönem sonu: {formatRequestDate(membership.currentPeriodEnd)}
            </div>
          ) : null}
          {quota ? (
            <div className="flex items-center gap-2 text-sm text-panel-text">
              <Users size={16} className="shrink-0 text-panel-text-muted" aria-hidden="true" />
              {isTeacher
                ? `${quota.usedSeats} / ${quota.totalSeats} öğrenci kullanımda`
                : `${quota.usedStudents} / ${quota.coveredSeats} çocuk kullanımda`}
            </div>
          ) : null}
        </div>
      </div>

      {seats.length > 0 ? (
        <div className="panel-card flex flex-col gap-3 p-5">
          <p className="text-sm font-bold text-panel-text">{seatsLabel}</p>
          <div className="flex flex-col gap-2">
            {seats.map((seat) => (
              <div
                key={seat.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-panel-border px-3 py-2"
              >
                <span className="min-w-0 text-sm text-panel-text">
                  {seat.planTitle}
                  {periodLabel(seat.period) ? ` · ${periodLabel(seat.period)}` : ''}
                  {seat.currentPeriodEnd ? ` · Dönem sonu: ${formatRequestDate(seat.currentPeriodEnd)}` : ''}
                </span>
                <StatusBadge status={seat.status} />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="panel-card flex flex-col gap-3 p-5">
        <p className="text-sm font-bold text-panel-text">Hesap Hareketleri</p>
        {data?.transactionsError ? (
          <div className="flex items-start gap-2 rounded-xl bg-panel-accent-soft px-3 py-2 text-xs text-panel-warm">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            Bazı işlemler iyzico'dan şu an alınamadı, aşağıdaki liste eksik olabilir.
          </div>
        ) : null}
        {!data?.transactions?.length ? (
          <p className="text-sm text-panel-text-muted">Henüz görüntülenecek bir hareket yok.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr className="border-b border-panel-border text-xs font-semibold uppercase text-panel-text-muted">
                  <th className="py-2 pr-3">Tarih</th>
                  <th className="py-2 pr-3">Paket</th>
                  <th className="py-2 pr-3">Durum</th>
                  <th className="py-2 pr-3">Tutar</th>
                </tr>
              </thead>
              <tbody>
                {data.transactions.map((tx, index) => (
                  <tr key={tx.referenceCode || index} className="border-b border-panel-border/60 last:border-0">
                    <td className="py-2 pr-3 text-panel-text">{tx.createdAt ? formatRequestDate(tx.createdAt) : '-'}</td>
                    <td className="py-2 pr-3 text-panel-text">{tx.source}</td>
                    <td className="py-2 pr-3">
                      <Badge tone={ORDER_STATUS_TONES[tx.status] || 'neutral'}>
                        {ORDER_STATUS_LABELS[tx.status] || tx.status || 'Bilinmiyor'}
                      </Badge>
                    </td>
                    <td className="py-2 pr-3 text-panel-text">{tx.amount != null ? `₺${formatTRY(tx.amount)}` : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {data?.canCancel ? (
        <div className="panel-card flex flex-col gap-3 p-5">
          <p className="text-sm font-bold text-panel-text">Üyeliği Durdur</p>
          <p className="text-sm text-panel-text-muted">
            {isTeacher
              ? 'Ek öğrenci koltuğu aboneliğiniz iptal edilir; taban paketiniz etkilenmez.'
              : 'Aboneliğiniz (varsa ek çocuk koltuklarınız dahil) iptal edilir, bir sonraki dönemde tekrar tahsilat yapılmaz.'}
          </p>
          <Button
            variant="secondary"
            className="w-fit border-panel-red/40 text-panel-red hover:bg-panel-red-soft"
            onClick={() => {
              setCancelError('')
              setCancelOpen(true)
            }}
          >
            Üyeliği Durdur
          </Button>
        </div>
      ) : null}

      {cancelOpen ? (
        <ConfirmationDialog
          title="Üyeliği Durdur"
          description={
            cancelError ||
            'Aboneliğiniz iptal edilecek ve bir sonraki dönemde tekrar tahsilat yapılmayacak. Bu işlem geri alınamaz. Devam edilsin mi?'
          }
          confirmLabel={cancelLoading ? 'İptal ediliyor...' : 'Evet, Durdur'}
          cancelLabel="Vazgeç"
          onConfirm={handleCancel}
          onCancel={() => {
            setCancelOpen(false)
            setCancelError('')
          }}
        />
      ) : null}
    </div>
  )
}
