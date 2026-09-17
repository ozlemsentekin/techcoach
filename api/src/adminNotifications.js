// Admin'e (site sahibi) önemli olaylarda SMS bildirimi. Şu an tek olay: yeni bir velinin
// ilk üyelik ödemesini tamamlaması (bkz. payments.js iyzicoCheckoutCallbackHandler, yeni
// hesap oluşturma dalı). Aylık/yıllık otomatik yenilemelerde bilinçli olarak SMS GÖNDERİLMİYOR
// (aktif üye arttıkça çok sık SMS gelirdi) — bkz. proje hafızası.
const { withRequest } = require('./db')
const { sendPlainSms } = require('./sms')

async function getAdminPhoneNumbers() {
  const db = await withRequest({})
  const result = await db.query(`
    SELECT phone_number FROM dbo.Users
    WHERE is_admin = 1 AND is_active = 1 AND phone_number IS NOT NULL;
  `)
  return result.recordset.map((row) => row.phone_number).filter(Boolean)
}

async function getParentPlanPrice(billingCycle) {
  const db = await withRequest({})
  const result = await db.query(`
    SELECT monthly_price, yearly_price FROM dbo.PricingPlans WHERE plan_key = 'parent';
  `)
  const plan = result.recordset[0]
  if (!plan) {
    return null
  }
  return billingCycle === 'yearly' ? plan.yearly_price : plan.monthly_price
}

// Hata SMS gönderimini asla yeni üye kaydı/ödeme akışını bozmasın diye burada yutuluyor —
// çağıran yer (payments.js) sonucu beklemez, sadece "denedi mi" bilgisiyle ilgilenmez.
async function notifyAdminsOfNewParentMembership({ fullName, phone, billingCycle }) {
  try {
    const [adminPhones, price] = await Promise.all([getAdminPhoneNumbers(), getParentPlanPrice(billingCycle)])
    if (!adminPhones.length) {
      return
    }

    const cycleLabel = billingCycle === 'yearly' ? 'yıllık' : 'aylık'
    const priceLabel = price != null ? `${Number(price).toLocaleString('tr-TR')} TL` : 'bilinmeyen tutar'
    const message = `TechCoach: Yeni üyelik! ${fullName || 'Bir veli'} (${phone || '-'}) ${cycleLabel} pakete ${priceLabel} ödeme yaptı.`

    await Promise.all(
      adminPhones.map((adminPhone) =>
        sendPlainSms(adminPhone, message).catch((error) => {
          console.error('notifyAdminsOfNewParentMembership: SMS gönderilemedi', adminPhone, error)
        }),
      ),
    )
  } catch (error) {
    console.error('notifyAdminsOfNewParentMembership failed', error)
  }
}

const ROLE_LABELS = {
  ebeveyn: 'veli',
  ogretmen: 'öğretmen',
}

// Bir kullanıcının aboneliği (admin'in "Pasife Al"/"Sil"i veya kendi "Üyeliği Durdur"u ile)
// gerçekten iyzico'da iptal edildiğinde admin'e SMS gider. Hata burada da yutulur — çağıran
// yer (entitlements.js cancelSubscriptionsForUser) sonucu beklemez.
async function notifyAdminsOfMembershipCancellation({ fullName, phone, role, cancelledCount }) {
  try {
    const adminPhones = await getAdminPhoneNumbers()
    if (!adminPhones.length) {
      return
    }

    const roleLabel = ROLE_LABELS[role] || 'kullanıcı'
    const seatWord = cancelledCount > 1 ? `${cancelledCount} abonelik` : 'aboneliği'
    const message = `TechCoach: Üyelik iptal edildi! ${fullName || 'Bir ' + roleLabel} (${phone || '-'}) ${roleLabel} ${seatWord} iptal etti.`

    await Promise.all(
      adminPhones.map((adminPhone) =>
        sendPlainSms(adminPhone, message).catch((error) => {
          console.error('notifyAdminsOfMembershipCancellation: SMS gönderilemedi', adminPhone, error)
        }),
      ),
    )
  } catch (error) {
    console.error('notifyAdminsOfMembershipCancellation failed', error)
  }
}

module.exports = { notifyAdminsOfNewParentMembership, notifyAdminsOfMembershipCancellation }
