import { authRequest } from './authClient'

/** iyzico abonelik checkout formunu başlatır (mevcut/oturum açmış veli). @returns {Promise<{checkoutFormContent: string, token: string}>} */
export async function initiateIyzicoCheckout({ billingCycle, email, identityNumber, address }) {
  return authRequest('/api/parent/payments/iyzico/checkout-initialize', {
    method: 'POST',
    body: JSON.stringify({ billingCycle, email, identityNumber, address }),
  })
}

/**
 * Mevcut veli için EK çocuk (çocuk-koltuğu) paketi checkout formunu başlatır. Yalnızca çocuk
 * ekleme kotası dolu olduğunda kullanılır. @returns {Promise<{checkoutFormContent: string, token: string}>}
 */
export async function initiateChildSeatCheckout({ billingCycle, email, identityNumber, address }) {
  return authRequest('/api/parent/payments/iyzico/child-seat-checkout-initialize', {
    method: 'POST',
    body: JSON.stringify({ billingCycle, email, identityNumber, address }),
  })
}

/**
 * Oturum açmış bir öğretmen için ek öğrenci koltuğu (öğrenci başı aylık 299 TL / yıllık 2.990 TL)
 * checkout formunu başlatır. Yalnızca kullanılabilir öğrenci hakkı kalmadığında kullanılır.
 * @returns {Promise<{checkoutFormContent: string, token: string}>}
 */
export async function initiateTeacherSeatCheckout({ billingCycle, email, identityNumber, address }) {
  return authRequest('/api/panel-teacher/payments/iyzico/seat-checkout-initialize', {
    method: 'POST',
    body: JSON.stringify({ billingCycle, email, identityNumber, address }),
  })
}

/**
 * Henüz hesabı olmayan yeni bir veli için: kayıt bilgileri + ödeme bilgileri birlikte gönderilir.
 * Kupon "DENEME" ise hesap anında açılıp `{ user }` döner (oturum çerezi otomatik ayarlanır);
 * aksi halde iyzico checkout formu döner, gerçek hesap yalnızca ödeme onaylandığında oluşur.
 * @returns {Promise<{checkoutFormContent?: string, token?: string, user?: object}>}
 */
export async function initiateIyzicoCheckoutForNewParent({
  fullName,
  phone,
  couponCode,
  acceptAydinlatma,
  acceptKvkk,
  turnstileToken,
  billingCycle,
  email,
  identityNumber,
  address,
}) {
  return authRequest('/api/payments/iyzico/parent-checkout-initialize', {
    method: 'POST',
    body: JSON.stringify({
      fullName,
      phone,
      couponCode,
      acceptAydinlatma,
      acceptKvkk,
      turnstileToken,
      billingCycle,
      email,
      identityNumber,
      address,
    }),
  })
}
