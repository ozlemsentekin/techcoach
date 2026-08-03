export const STUDENT_PRIMARY_NAV = [
  { to: '/student/today', label: 'Bugün', icon: 'Home' },
  { to: '/student/progress', label: 'Gelişimim', icon: 'TrendingUp' },
  { to: '/student/courses', label: 'Derslerim', icon: 'BookOpen' },
]

export const STUDENT_MORE_NAV = [
  { to: '/student/teachers', label: 'Öğretmenlerim', icon: 'GraduationCap' },
  { to: '/student/homework', label: 'Ödevlerim', icon: 'NotebookPen' },
  { to: '/student/mistakes', label: 'Hata Defterim', icon: 'AlertCircle' },
]

export const STUDENT_SIDEBAR_NAV = [...STUDENT_PRIMARY_NAV, ...STUDENT_MORE_NAV]

export const PARENT_PRIMARY_NAV = [
  { to: '/parent/dashboard', label: 'Bugün', icon: 'Home' },
  { to: '/parent/weekly-plan', label: 'Haftalık Plan', icon: 'CalendarRange' },
  { to: '/parent/homework', label: 'Ödevler', icon: 'NotebookPen' },
  { to: '/parent/messages', label: 'Mesajlar', icon: 'MessageCircle' },
]

export const PARENT_MORE_NAV = [
  { to: '/parent/weekly-plan?openDrawer=1', label: 'Plan Oluştur', icon: 'ClipboardList' },
  { to: '/parent/tests', label: 'Test ve Denemeler', icon: 'FileCheck2' },
  { to: '/parent/progress', label: 'Gelişim', icon: 'TrendingUp' },
  { to: '/parent/mistakes', label: 'Yanlışlar', icon: 'AlertCircle' },
  { to: '/parent/students', label: 'Öğrenciler', icon: 'Users' },
  { to: '/parent/teachers', label: 'Öğretmenler', icon: 'GraduationCap' },
  { to: '/parent/settings', label: 'Ayarlar', icon: 'Settings' },
]

export const PARENT_SIDEBAR_NAV = [...PARENT_PRIMARY_NAV, ...PARENT_MORE_NAV]

export function isNavItemActive(to, location) {
  const [path, search = ''] = to.split('?')
  if (location.pathname !== path) return false
  return location.search.replace(/^\?/, '') === search
}

export const PARENT_ADMIN_NAV = {
  label: 'Admin Paneli',
  icon: 'ShieldCheck',
  children: [
    { to: '/parent/admin/users', label: 'Üyeler', icon: 'Users' },
    { to: '/parent/admin/subjects', label: 'Dersler', icon: 'BookOpen' },
    { to: '/parent/admin/publishers', label: 'Yayın Evleri', icon: 'Building2' },
    { to: '/parent/admin/motivation-messages', label: 'Motivasyon Mesajları', icon: 'Sparkles' },
    { to: '/parent/admin/greetings', label: 'Selamlama Metinleri', icon: 'Clock' },
  ],
}
