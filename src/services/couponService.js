import { authRequest } from './authClient'

// Admin "Kuponlar" ekranı — veli aboneliği için yüzdelik indirim kuponları. Her kupon
// oluşturulduğunda backend iyzico'da ona özel indirimli bir abonelik planı oluşturur
// (bkz. api/src/coupons.js); kod/yüzde sonradan değiştirilemez, yalnızca aktif/pasif +
// açıklama güncellenebilir.

export async function getAdminCoupons() {
  const data = await authRequest('/api/panel-admin/coupons', { method: 'GET' })
  return data.coupons
}

export async function createCoupon({ code, discountPercent, description }) {
  const data = await authRequest('/api/panel-admin/coupons', {
    method: 'POST',
    body: JSON.stringify({ code, discountPercent, description }),
  })
  return data.coupon
}

export async function updateCoupon(couponId, { isActive, description }) {
  const data = await authRequest(`/api/panel-admin/coupons/${couponId}`, {
    method: 'PUT',
    body: JSON.stringify({ isActive, description }),
  })
  return data.coupon
}

export async function deleteCoupon(couponId) {
  return authRequest(`/api/panel-admin/coupons/${couponId}`, { method: 'DELETE' })
}
