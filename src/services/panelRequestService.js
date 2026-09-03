import { authRequest } from './authClient'

// Panel talep sistemi (bkz. api/src/panelRequests.js). İki tür: 'kitap-ekleme' (kapak +
// içindekiler + cevap anahtarı fotoğraflarıyla kütüphaneye kitap eklenmesi talebi) ve
// 'genel' (serbest konu + açıklama). Sonuç "Taleplerim" menüsünden takip edilir; her talep
// üzerinde talep sahibi ile yönetici karşılıklı not yazışır. Admin "Talepler" ekranından
// tamamlandı / iptal işaretler veya yeniden açar.

export const PANEL_REQUEST_TYPE_LABELS = {
  'kitap-ekleme': 'Kitap ekleme talebi',
  genel: 'Genel talep',
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

export async function createGeneralPanelRequest({ title, description }) {
  const data = await authRequest('/api/panel/requests', {
    method: 'POST',
    body: JSON.stringify({ type: 'genel', title, description }),
  })
  return data.request
}

export async function addPanelRequestMessage(requestId, body) {
  const data = await authRequest(`/api/panel/requests/${requestId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  })
  return data.message
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
