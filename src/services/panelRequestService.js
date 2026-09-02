import { authRequest } from './authClient'

// Panel talep sistemi (bkz. api/src/panelRequests.js). Şimdilik tek tür: 'kitap-ekleme'.
// Veli / öğretmen / öğrenci bir kitabın fotoğraflarını yükleyip kütüphaneye eklenmesini
// talep eder; sonucu "Taleplerim" menüsünden takip eder. Admin "Kitap Talepleri"
// ekranından tamamlandı / iptal işaretler.

export const PANEL_REQUEST_TYPE_LABELS = {
  'kitap-ekleme': 'Kitap ekleme talebi',
}

export const PANEL_REQUEST_STATUS_LABELS = {
  beklemede: 'Beklemede',
  tamamlandi: 'Tamamlandı',
  iptal: 'İptal edildi',
}

export async function createPanelRequest(payload) {
  const data = await authRequest('/api/panel/requests', {
    method: 'POST',
    timeoutMs: 60000,
    body: JSON.stringify(payload),
  })
  return data.request
}

export async function getMyPanelRequests() {
  const data = await authRequest('/api/panel/requests', { method: 'GET' })
  return data.requests
}

export async function getPanelRequest(requestId) {
  const data = await authRequest(`/api/panel/requests/${requestId}`, { method: 'GET' })
  return data.request
}

export async function getAdminPanelRequests({ type, status } = {}) {
  const params = new URLSearchParams()
  if (type) params.set('type', type)
  if (status) params.set('status', status)
  const query = params.toString() ? `?${params.toString()}` : ''
  const data = await authRequest(`/api/panel-admin/requests${query}`, { method: 'GET' })
  return data.requests
}

export async function updateAdminPanelRequest(requestId, { status, adminNote }) {
  const data = await authRequest(`/api/panel-admin/requests/${requestId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status, adminNote }),
  })
  return data.request
}
