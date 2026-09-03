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
  { to: '/student/mistakes', label: 'Hata Defterim', icon: 'AlertCircle' },
  { to: '/student/progress', label: 'Gelişimim', icon: 'TrendingUp' },
]

export const STUDENT_MORE_NAV = [
  { to: '/student/courses', label: 'Derslerim', icon: 'BookOpen' },
  { to: '/student/teachers', label: 'Öğretmenlerim', icon: 'GraduationCap' },
  { to: '/student/requests', label: 'Taleplerim', icon: 'ClipboardList' },
]

export const STUDENT_SIDEBAR_NAV = [...STUDENT_PRIMARY_NAV, ...STUDENT_MORE_NAV]

export const PARENT_STUDENTS_NAV_ITEM = { to: '/parent/students', label: 'Çocuklarım', icon: 'Users' }
export const PARENT_REQUESTS_NAV_ITEM = { to: '/parent/requests', label: 'Taleplerim', icon: 'ClipboardList' }

export const PARENT_MORE_NAV = [PARENT_STUDENTS_NAV_ITEM, PARENT_REQUESTS_NAV_ITEM]

// Henüz hiç çocuk profili eklenmemiş bir veli için Bugün/Haftalık Plan sayfalarının
// hepsi boş/hatalı görünür (bunlar bir öğrenci bağlamı gerektirir); o yüzden ilk kayıtta tek
// birincil menü öğesi olarak yalnızca Çocuklarım gösterilir.
export function getParentPrimaryNav(hasStudents, canManageLibrary = false) {
  if (!hasStudents) return [PARENT_STUDENTS_NAV_ITEM]
  return [
    { to: '/parent/dashboard', label: 'Bugün', icon: 'Home' },
    { to: '/parent/weekly-plan', label: 'Haftalık Plan', icon: 'CalendarRange' },
    canManageLibrary ? KUTUPHANE_PARENT_ITEM : KITAPLIK_PARENT_ITEM,
  ]
}

export function getParentMoreNav(isAdmin, hasStudents = true) {
  const base = isAdmin
    ? [KITAPLIK_PARENT_ITEM, ...PARENT_MORE_NAV]
    : [...PARENT_MORE_NAV]
  // Çocuklarım hiç öğrenci yokken zaten birincil menüde gösteriliyor, burada tekrar etmesin.
  return hasStudents ? base : base.filter((item) => item.to !== PARENT_STUDENTS_NAV_ITEM.to)
}

export function getParentSidebarNav(isAdmin, hasStudents = true, canManageLibrary = false) {
  return [
    ...getParentPrimaryNav(hasStudents, canManageLibrary || isAdmin),
    ...getParentMoreNav(isAdmin, hasStudents),
  ]
}

export function isNavItemActive(to, location) {
  const [path, search = ''] = to.split('?')
  if (location.pathname !== path) return false
  return location.search.replace(/^\?/, '') === search
}

// "Sınıf Analizi" tüm öğretmenlerde görünür; sayfa, öğrencilerin sınıf bilgisinden
// sekmeleri kendisi oluşturur (sınıf bilgisi yoksa yönlendirici bir boş durum gösterir).
export function getTeacherPrimaryNav(canManageLibrary = false) {
  return [
    { to: '/teacher/students', label: 'Öğrencilerim', icon: 'Users' },
    { to: '/teacher/class-analysis', label: 'Sınıf Analizi', icon: 'BarChart3' },
    { to: '/teacher/lesson-plan', label: 'Ders Planım', icon: 'CalendarRange' },
    { to: '/teacher/parents', label: 'Velilerim', icon: 'UserRound' },
    canManageLibrary ? KUTUPHANE_TEACHER_ITEM : KITAPLIK_TEACHER_ITEM,
  ]
}

export const TEACHER_MORE_NAV = [
  { to: '/teacher/requests', label: 'Taleplerim', icon: 'ClipboardList' },
]

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
    { to: '/parent/admin/book-requests', label: 'Talepler', icon: 'ClipboardList' },
    { to: '/parent/admin/schools', label: 'Okul Yönetimi', icon: 'School' },
    { to: '/parent/admin/motivation-messages', label: 'Motivasyon Mesajları', icon: 'Sparkles' },
    { to: '/parent/admin/greetings', label: 'Selamlama Metinleri', icon: 'Clock' },
  ],
}
