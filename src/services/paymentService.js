import { authRequest } from './authClient'

/** iyzico abonelik checkout formunu başlatır (mevcut/oturum açmış veli). @returns {Promise<{checkoutFormContent: string, token: string}>} */
export async function initiateIyzicoCheckout({ billingCycle, identityNumber, address }) {
  return authRequest('/api/parent/payments/iyzico/checkout-initialize', {
    method: 'POST',
    body: JSON.stringify({ billingCycle, identityNumber, address }),
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
      identityNumber,
      address,
    }),
  })
}
