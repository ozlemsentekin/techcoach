import { authRequest } from './authClient'

// Bildirim merkezi — öğrencinin/çocuğun görev işlemleri akışı + okundu durumu.
// cachedGet kullanılmıyor: kısa TTL rozet sayısını yanıltıcı hale getirir;
// NotificationBell zaten useVisiblePolling ile 30sn'de bir yeniler.

/** @returns {Promise<{ notifications: Array, unreadCount: number }>} */
export async function getParentNotifications({ limit = 40 } = {}) {
  const data = await authRequest(`/api/panel/notifications?limit=${limit}`, { method: 'GET' })
  return { notifications: data.notifications || [], unreadCount: data.unreadCount || 0 }
}

export async function markParentNotificationRead(activityId) {
  await authRequest(`/api/panel/notifications/${activityId}/read`, { method: 'PATCH' })
}

export async function markAllParentNotificationsRead() {
  await authRequest('/api/panel/notifications/read-all', { method: 'POST' })
}

/** @returns {Promise<{ notifications: Array, unreadCount: number }>} */
export async function getTeacherNotifications({ limit = 40 } = {}) {
  const data = await authRequest(`/api/panel-teacher/notifications?limit=${limit}`, { method: 'GET' })
  return { notifications: data.notifications || [], unreadCount: data.unreadCount || 0 }
}

export async function markTeacherNotificationRead(activityId) {
  await authRequest(`/api/panel-teacher/notifications/${activityId}/read`, { method: 'PATCH' })
}

export async function markAllTeacherNotificationsRead() {
  await authRequest('/api/panel-teacher/notifications/read-all', { method: 'POST' })
}
