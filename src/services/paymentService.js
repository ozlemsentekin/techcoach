import { authRequest } from './authClient'

/** iyzico abonelik checkout formunu başlatır. @returns {Promise<{checkoutFormContent: string, token: string}>} */
export async function initiateIyzicoCheckout({ billingCycle, identityNumber, address }) {
  return authRequest('/api/parent/payments/iyzico/checkout-initialize', {
    method: 'POST',
    body: JSON.stringify({ billingCycle, identityNumber, address }),
  })
}
