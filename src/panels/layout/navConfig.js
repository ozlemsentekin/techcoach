// "Kütüphane" (sistem kataloğu) menüsü yalnızca kütüphaneye işlem yapabilenlerde görünür
// (admin veya can_manage_library). Yetkisi olmayan veli/öğretmen/öğrenci bunun yerine
// "Kitaplık" (yalnızca kendi üçgenlerine görünen özel kaynak rafı) görür. Admin ikisini de
// görür: Kütüphane birincil menüde, Kitaplık "Diğer" menüsünde.
const KUTUPHANE_PARENT_ITEM = { to: '/parent/library', label: 'Kütüphane', icon: 'Library' }
const KITAPLIK_PARENT_ITEM = { to: '/parent/bookshelf', label: 'Kitaplık', icon: 'BookMarked' }
const KUTUPHANE_TEACHER_ITEM = { to: '/teacher/library', label: 'Kütüphane', icon: 'Library' }
const KITAPLIK_TEACHER_ITEM = { to: '/teacher/bookshelf', label: 'Kitaplık', icon: 'BookMarked' }

export const STUDENT_PRIMARY_NAV = [
  { to: '/student/today', label: 'Bugün', icon: 'Home' },
  { to: '/student/weekly-plan', label: 'Haftalık Planım', icon: 'CalendarRange' },
  { to: '/student/progress', label: 'Gelişimim', icon: 'TrendingUp' },
  { to: '/student/courses', label: 'Derslerim', icon: 'BookOpen' },
]

export const STUDENT_MORE_NAV = [
  { to: '/student/teachers', label: 'Öğretmenlerim', icon: 'GraduationCap' },
  { to: '/student/bookshelf', label: 'Kitaplık', icon: 'BookMarked' },
  { to: '/student/mistakes', label: 'Hata Defterim', icon: 'AlertCircle' },
]

export const STUDENT_SIDEBAR_NAV = [...STUDENT_PRIMARY_NAV, ...STUDENT_MORE_NAV]

export const PARENT_STUDENTS_NAV_ITEM = { to: '/parent/students', label: 'Çocuklarım', icon: 'Users' }

// Mesajlar şimdilik yalnızca admin yetkili veli hesaplarına gösteriliyor.
export const PARENT_ADMIN_ONLY_NAV = [{ to: '/parent/messages', label: 'Mesajlar', icon: 'MessageCircle' }]

const sortNavItemsByLabel = (items) =>
  [...items].sort((a, b) => a.label.localeCompare(b.label, 'tr'))

// Henüz hiç çocuk profili eklenmemiş bir veli için Bugün/Haftalık Plan sayfalarının
// hepsi boş/hatalı görünür (bunlar bir öğrenci bağlamı gerektirir); o yüzden ilk kayıtta tek
// birincil menü öğesi olarak yalnızca Çocuklarım gösterilir.
// Aksi halde ilk üç birincil menü öğesi sabit sıradadır: Bugün, Haftalık Plan, Çocuklarım.
export function getParentPrimaryNav(hasStudents) {
  if (!hasStudents) return [PARENT_STUDENTS_NAV_ITEM]
  return [
    { to: '/parent/dashboard', label: 'Bugün', icon: 'Home' },
    { to: '/parent/weekly-plan', label: 'Haftalık Plan', icon: 'CalendarRange' },
    PARENT_STUDENTS_NAV_ITEM,
  ]
}

// İlk üç sabit öğeden sonra kalan menüler alfabetik sırayla gösterilir.
export function getParentMoreNav(isAdmin, hasStudents = true, canManageLibrary = false) {
  if (!hasStudents) return []
  const items = [canManageLibrary || isAdmin ? KUTUPHANE_PARENT_ITEM : KITAPLIK_PARENT_ITEM]
  if (isAdmin) {
    items.push(KITAPLIK_PARENT_ITEM, ...PARENT_ADMIN_ONLY_NAV)
  }
  return sortNavItemsByLabel(items)
}

export function getParentSidebarNav(isAdmin, hasStudents = true, canManageLibrary = false) {
  return [
    ...getParentPrimaryNav(hasStudents),
    ...getParentMoreNav(isAdmin, hasStudents, canManageLibrary),
  ]
}

export function isNavItemActive(to, location) {
  const [path, search = ''] = to.split('?')
  if (location.pathname !== path) return false
  return location.search.replace(/^\?/, '') === search
}

export function getTeacherPrimaryNav(canManageLibrary = false) {
  return [
    { to: '/teacher/students', label: 'Öğrencilerim', icon: 'Users' },
    { to: '/teacher/lesson-plan', label: 'Ders Planım', icon: 'CalendarRange' },
    { to: '/teacher/parents', label: 'Velilerim', icon: 'UserRound' },
    canManageLibrary ? KUTUPHANE_TEACHER_ITEM : KITAPLIK_TEACHER_ITEM,
  ]
}

export const TEACHER_MORE_NAV = []

export function getTeacherSidebarNav(canManageLibrary = false) {
  return [...getTeacherPrimaryNav(canManageLibrary), ...TEACHER_MORE_NAV]
}

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
