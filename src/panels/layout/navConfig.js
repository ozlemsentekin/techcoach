export const STUDENT_PRIMARY_NAV = [
  { to: '/student/today', label: 'Bugün', icon: 'Home' },
  { to: '/student/weekly-plan', label: 'Haftalık Planım', icon: 'CalendarRange' },
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
  { to: '/parent/library', label: 'Kütüphane', icon: 'Library' },
]

export const PARENT_STUDENTS_NAV_ITEM = { to: '/parent/students', label: 'Çocuklarım', icon: 'Users' }

export const PARENT_MORE_NAV = [PARENT_STUDENTS_NAV_ITEM]

// Mesajlar şimdilik yalnızca admin yetkili veli hesaplarına gösteriliyor.
export const PARENT_ADMIN_ONLY_NAV = [{ to: '/parent/messages', label: 'Mesajlar', icon: 'MessageCircle' }]

// Henüz hiç çocuk profili eklenmemiş bir veli için Bugün/Haftalık Plan/Ödevler sayfalarının
// hepsi boş/hatalı görünür (bunlar bir öğrenci bağlamı gerektirir); o yüzden ilk kayıtta tek
// birincil menü öğesi olarak yalnızca Çocuklarım gösterilir.
export function getParentPrimaryNav(hasStudents) {
  return hasStudents ? PARENT_PRIMARY_NAV : [PARENT_STUDENTS_NAV_ITEM]
}

export function getParentMoreNav(isAdmin, hasStudents = true) {
  const base = isAdmin ? [...PARENT_ADMIN_ONLY_NAV, ...PARENT_MORE_NAV] : PARENT_MORE_NAV
  // Çocuklarım hiç öğrenci yokken zaten birincil menüde gösteriliyor, burada tekrar etmesin.
  return hasStudents ? base : base.filter((item) => item.to !== PARENT_STUDENTS_NAV_ITEM.to)
}

export function getParentSidebarNav(isAdmin, hasStudents = true) {
  return [...getParentPrimaryNav(hasStudents), ...getParentMoreNav(isAdmin, hasStudents)]
}

export function isNavItemActive(to, location) {
  const [path, search = ''] = to.split('?')
  if (location.pathname !== path) return false
  return location.search.replace(/^\?/, '') === search
}

export const TEACHER_PRIMARY_NAV = [
  { to: '/teacher/students', label: 'Öğrencilerim', icon: 'Users' },
  { to: '/teacher/lesson-plan', label: 'Ders Planım', icon: 'CalendarRange' },
  { to: '/teacher/parents', label: 'Velilerim', icon: 'UserRound' },
  { to: '/teacher/library', label: 'Kütüphane', icon: 'Library' },
]

export const TEACHER_MORE_NAV = []

export const TEACHER_SIDEBAR_NAV = [...TEACHER_PRIMARY_NAV, ...TEACHER_MORE_NAV]

export const PARENT_ADMIN_NAV = {
  label: 'Admin Paneli',
  icon: 'ShieldCheck',
  children: [
    { to: '/parent/admin/users', label: 'Üyeler', icon: 'Users' },
    { to: '/parent/admin/subjects', label: 'Dersler', icon: 'BookOpen' },
    { to: '/parent/admin/publishers', label: 'Yayın Evleri', icon: 'Building2' },
    { to: '/parent/admin/missing-answer-keys', label: 'Eksik Cevap Anahtarları', icon: 'AlertCircle' },
    { to: '/parent/admin/schools', label: 'Okul Yönetimi', icon: 'School' },
    { to: '/parent/admin/motivation-messages', label: 'Motivasyon Mesajları', icon: 'Sparkles' },
    { to: '/parent/admin/greetings', label: 'Selamlama Metinleri', icon: 'Clock' },
  ],
}
