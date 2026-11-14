export function panelPathForRole(role) {
  if (role === 'ebeveyn') return '/parent/dashboard'
  if (role === 'ogretmen') return '/teacher/students'
  return '/student/today'
}

const PANEL_PREFIX_BY_ROLE = { ebeveyn: '/parent/', ogretmen: '/teacher/', ogrenci: '/student/' }

// Giriş sonrası dönülecek adres: yalnızca kullanıcının kendi paneline ait, site içi bir yol kabul
// edilir (açık yönlendirme / başka rolün paneli → varsayılan panel sayfası).
export function postLoginPath(role, next) {
  const fallback = panelPathForRole(role)
  if (typeof next !== 'string' || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return fallback
  const prefix = PANEL_PREFIX_BY_ROLE[role] || PANEL_PREFIX_BY_ROLE.ogrenci
  return next.startsWith(prefix) ? next : fallback
}
