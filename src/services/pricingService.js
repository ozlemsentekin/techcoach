import { authRequest } from './authClient'

// Kayıt / ödeme / koltuk satın alma ekranları fiyatları bu genel uçtan okur.
// Admin "Üyelik Paketleri" ekranından güncellenir. Oturum başına bir kez çekilip
// modül seviyesinde cache'lenir.
let publicPricingPromise = null

export function getPublicPricing() {
  if (!publicPricingPromise) {
    publicPricingPromise = authRequest('/api/pricing', { method: 'GET' })
      .then((data) => data.plans || {})
      .catch((error) => {
        publicPricingPromise = null
        throw error
      })
  }
  return publicPricingPromise
}

// ---- Admin ----

export async function getAdminPricingPlans() {
  const data = await authRequest('/api/panel-admin/pricing-plans', { method: 'GET' })
  return data.plans
}

export async function updatePricingPlan(planKey, { title, monthlyPrice, yearlyPrice, yearlyBadge, features, note }) {
  const data = await authRequest(`/api/panel-admin/pricing-plans/${planKey}`, {
    method: 'PUT',
    body: JSON.stringify({ title, monthlyPrice, yearlyPrice, yearlyBadge, features, note }),
  })
  return data.plan
}

// iyzico'da DB'deki güncel fiyatla yeni abonelik planı oluşturur; dönen referans
// kodları Azure App Settings'e elle yazılır. Bkz. pricing.js refreshIyzicoPlanHandler.
export async function refreshIyzicoPlan(planKey) {
  return authRequest(`/api/panel-admin/pricing-plans/${planKey}/iyzico-refresh`, { method: 'POST' })
}
