import { useEffect, useState } from 'react'
import { getPublicPricing } from '../services/pricingService'

// Admin "Üyelik Paketleri" ekranı henüz doldurulmadıysa ya da /api/pricing'e
// ulaşılamazsa kullanılan yedek değerler. DB seed'i (create-pricing-plans-schema.sql)
// ile aynı tutulmalı.
export const PRICING_DEFAULTS = {
  parent: {
    planKey: 'parent',
    title: 'Veli Takip Paketi',
    monthlyPrice: 2999,
    yearlyPrice: 24000,
    yearlyBadge: '%20 indirim',
    features: [
      '2 öğrenciye kadar tam erişim',
      'Günlük çalışma planı ve ders ajandası görünürlüğü',
      'Hata defteri ile konu bazlı tekrar takibi',
      'Haftalık ilerleme raporu ve risk uyarıları',
      'Sınav takvimini fotoğrafla saniyeler içinde içe aktarma',
      'Öğretmenle paylaşımlı görünüm ve bildirimler',
    ],
    note: null,
  },
  teacher: {
    planKey: 'teacher',
    title: 'Öğretmen İş Paketi',
    monthlyPrice: 2999,
    yearlyPrice: null,
    yearlyBadge: null,
    features: [
      '4 öğrenciye kadar dahil, ek öğrenci 299 TL / ay',
      'Sınıf geneli hata yoğunluğu ve öncelik alanları analizi',
      'Öğrenci bazlı haftalık performans raporları',
      'Ödev ve sınav atama, teslim takibi',
      'Velilerle otomatik paylaşım ve bildirim akışı',
      'Öncelikli destek hattı',
    ],
    note: 'Kart tahsilatı yakında aktif olacak; üye olduğunuzda hesabınız deneme durumunda hemen açılır.',
  },
  teacher_seat: {
    planKey: 'teacher_seat',
    title: 'Öğretmen Ek Öğrenci Paketi',
    monthlyPrice: 299,
    yearlyPrice: 4990,
    yearlyBadge: '2 ay bedava',
    features: [],
    note: null,
  },
  child_seat: {
    planKey: 'child_seat',
    title: 'Ek Çocuk Paketi',
    monthlyPrice: 1999,
    yearlyPrice: 14999,
    yearlyBadge: '2 ay bedava',
    features: [],
    note: null,
  },
}

export function formatTRY(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return String(value ?? '')
  }
  return numeric.toLocaleString('tr-TR')
}

// Genel fiyatları çeker; yüklenene kadar (ve hata durumunda) PRICING_DEFAULTS döner.
// Dönen nesnede her plan anahtarı her zaman doludur.
export function usePublicPricing() {
  const [plans, setPlans] = useState(PRICING_DEFAULTS)

  useEffect(() => {
    let active = true
    getPublicPricing()
      .then((remote) => {
        if (!active || !remote) {
          return
        }
        setPlans({
          parent: { ...PRICING_DEFAULTS.parent, ...(remote.parent || {}) },
          teacher: { ...PRICING_DEFAULTS.teacher, ...(remote.teacher || {}) },
          teacher_seat: { ...PRICING_DEFAULTS.teacher_seat, ...(remote.teacher_seat || {}) },
          child_seat: { ...PRICING_DEFAULTS.child_seat, ...(remote.child_seat || {}) },
        })
      })
      .catch(() => {
        /* yedek değerlerle devam */
      })
    return () => {
      active = false
    }
  }, [])

  return plans
}
