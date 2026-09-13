import { cachedGet } from './authClient'

const PANEL_HOMEWORK_RESOURCE_BOOKS_PATH = '/api/panel/resource-books'
const PANEL_HOMEWORK_RESOURCE_BOOKS_TTL_MS = 60000

export async function getPanelHomeworkResourceBooks() {
  const data = await cachedGet(PANEL_HOMEWORK_RESOURCE_BOOKS_PATH, {
    ttlMs: PANEL_HOMEWORK_RESOURCE_BOOKS_TTL_MS,
  })
  return data.resourceBooks || []
}

export function preloadPanelHomeworkResourceBooks() {
  getPanelHomeworkResourceBooks().catch(() => undefined)
}

/** Hata Defteri "+ Hata Ekle" akışı: belirli bir öğrenciye atanmış kitapları getirir (herhangi bir content_mode). */
export async function getResourceBooksForStudent(studentId) {
  const path = studentId
    ? `${PANEL_HOMEWORK_RESOURCE_BOOKS_PATH}?studentId=${studentId}`
    : PANEL_HOMEWORK_RESOURCE_BOOKS_PATH
  const data = await cachedGet(path, { ttlMs: PANEL_HOMEWORK_RESOURCE_BOOKS_TTL_MS })
  return data.resourceBooks || []
}
