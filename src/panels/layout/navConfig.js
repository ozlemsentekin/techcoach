// "Kütüphane" (sistem kataloğu) menüsü yalnızca kütüphaneye işlem yapabilenlerde görünür
// (admin veya can_manage_library). Yetkisi olmayan veli/öğretmen/öğrenci bunun yerine
// "Kitaplık" (yalnızca kendi üçgenlerine görünen özel kaynak rafı) görür. Admin ikisini de
// görür: Kütüphane birincil menüde, Kitaplık "Diğer" menüsünde.
const KUTUPHANE_PARENT_ITEM = { to: '/parent/library', label: 'Kütüphane', icon: 'Library' }
const KITAPLIK_PARENT_ITEM = { to: '/parent/bookshelf', label: 'Kitaplık', icon: 'BookMarked' }
const KUTUPHANE_TEACHER_ITEM = { to: '/teacher/library', label: 'Kütüphane', icon: 'Library' }
const KITAPLIK_TEACHER_ITEM = { to: '/teacher/bookshelf', label: 'Kitaplık', icon: 'BookMarked' }

// Öğrenci menüsü iki ana başlık altında gruplanır ("Çalışma Planım", "Çalışma
// Sonuçlarım"); "Öğretmenlerim" ve "Taleplerim" tekil öğe olarak kalır.
// "AI Raporları" şimdilik yalnızca admin ve admin'e bağlı öğrenci profilinde görünür
// (authUser.aiReportsEnabled, backend'de hesaplanır).
export function getStudentNav({ aiReportsEnabled = false } = {}) {
  return [
    {
      key: 'calisma-planim',
      label: 'Çalışma Planım',
      icon: 'CalendarRange',
      children: [
        { to: '/student/today', label: 'Bugün', icon: 'Home' },
        { to: '/student/weekly-plan', label: 'Bu Hafta', icon: 'CalendarRange' },
      ],
    },
    {
      key: 'calisma-sonuclarim',
      label: 'Çalışma Sonuçlarım',
      icon: 'BarChart3',
      children: [
        { to: '/student/study-history', label: 'Çalışma Geçmişim', icon: 'History' },
        { to: '/student/mistakes', label: 'Hata Defterim', icon: 'AlertCircle' },
        ...(aiReportsEnabled ? [{ to: '/student/ai-reports', label: 'AI Raporları', icon: 'Sparkles' }] : []),
        { to: '/student/mock-exams', label: 'Deneme Sınavları', icon: 'FileCheck2' },
        { to: '/student/progress', label: 'Gelişimim', icon: 'TrendingUp' },
        { to: '/student/courses', label: 'Ders Başarım', icon: 'BookOpen' },
      ],
    },
    { to: '/student/teachers', label: 'Öğretmenlerim', icon: 'GraduationCap' },
    { to: '/student/requests', label: 'Taleplerim', icon: 'ClipboardList' },
    { to: '/student/guide', label: 'Rehber', icon: 'BookOpen' },
  ]
}

export const STUDENT_NAV = getStudentNav()

export const PARENT_STUDENTS_NAV_ITEM = { to: '/parent/students', label: 'Çocuklarım', icon: 'Users' }
export const PARENT_GUIDE_NAV_ITEM = { to: '/parent/guide', label: 'Rehber', icon: 'BookOpen' }
export const PARENT_REQUESTS_NAV_ITEM = { to: '/parent/requests', label: 'Taleplerim', icon: 'ClipboardList' }

// Tek çocuğu olan veli için menü adı "Çocuğum", birden fazlası (veya bilinmiyor) için "Çocuklarım".
export function parentStudentsNavLabel(studentCount) {
  return studentCount === 1 ? 'Çocuğum' : 'Çocuklarım'
}

export function getParentStudentsNavItem(studentCount) {
  return { ...PARENT_STUDENTS_NAV_ITEM, label: parentStudentsNavLabel(studentCount) }
}

// Gruplu bir menüyü mobil alt gezinme için ikiye ayırır: ilk grup birincil (alt bar),
// kalanı grup başlıklarıyla "Daha Fazla" listesine akar. Grup yoksa hepsi birincil olur.
export function navToMobile(nav) {
  const firstGroup = nav.findIndex((item) => item.children)
  if (firstGroup === -1) return { primary: nav, more: [] }
  const primary = nav[firstGroup].children
  const more = nav
    .filter((_, index) => index !== firstGroup)
    .flatMap((item) => (item.children ? [{ heading: item.label }, ...item.children] : [item]))
  return { primary, more }
}

// Veli menüsü öğrenci paneliyle aynı stilde gruplanır. Henüz hiç çocuk profili
// eklenmemiş bir veli için Bugün/Haftalık Plan sayfaları boş görünür (öğrenci bağlamı
// gerektirir); o yüzden ilk kayıtta yalnızca Çocuklarım + Taleplerim gösterilir.
export function getParentNav({ hasStudents = true, canManageLibrary = false, isAdmin = false, studentCount = null } = {}) {
  const studentsItem = getParentStudentsNavItem(studentCount)
  if (!hasStudents) return [studentsItem, PARENT_REQUESTS_NAV_ITEM, PARENT_GUIDE_NAV_ITEM]

  const canManage = canManageLibrary || isAdmin
  // "Kitaplık" (özel kaynak rafı) artık "Çalışma Sonuçları" grubunun altında.
  // "Kütüphane" (sistem kataloğu) yalnızca yetkililerde ve birincil menüde kalır.
  const showKitaplik = isAdmin || !canManage
  const kutuphaneItems = canManage ? [KUTUPHANE_PARENT_ITEM] : []

  return [
    {
      key: 'calisma-plani',
      label: 'Çalışma Planı',
      icon: 'CalendarRange',
      children: [
        { to: '/parent/dashboard', label: 'Bugün', icon: 'Home' },
        { to: '/parent/weekly-plan', label: 'Bu Hafta', icon: 'CalendarRange' },
      ],
    },
    {
      key: 'calisma-sonuclari',
      label: 'Çalışma Sonuçları',
      icon: 'BarChart3',
      children: [
        { to: '/parent/study-history', label: 'Çalışma Geçmişi', icon: 'History' },
        { to: '/parent/mistakes', label: 'Hata Defteri', icon: 'AlertCircle' },
        // "AI Raporları" şimdilik yalnızca admin veli hesabında.
        ...(isAdmin ? [{ to: '/parent/ai-reports', label: 'AI Raporları', icon: 'Sparkles' }] : []),
        { to: '/parent/mock-exams', label: 'Deneme Sınavları', icon: 'FileCheck2' },
        { to: '/parent/progress', label: 'Gelişim Analizi', icon: 'TrendingUp' },
        ...(showKitaplik ? [KITAPLIK_PARENT_ITEM] : []),
      ],
    },
    ...kutuphaneItems,
    studentsItem,
    PARENT_REQUESTS_NAV_ITEM,
    PARENT_GUIDE_NAV_ITEM,
  ]
}

export function isNavItemActive(to, location) {
  const [path, search = ''] = to.split('?')
  if (location.pathname !== path) return false
  return location.search.replace(/^\?/, '') === search
}

// Öğretmen menüsü de öğrenci/veli paneliyle aynı stilde gruplanır.
// "Sınıf Analizi" tüm öğretmenlerde görünür; sayfa, öğrencilerin sınıf bilgisinden
// sekmeleri kendisi oluşturur (sınıf bilgisi yoksa yönlendirici bir boş durum gösterir).
export function getTeacherNav(canManageLibrary = false) {
  return [
    {
      key: 'kisilerim',
      label: 'Kişilerim',
      icon: 'Users',
      children: [
        { to: '/teacher/students', label: 'Öğrencilerim', icon: 'Users' },
        { to: '/teacher/parents', label: 'Velilerim', icon: 'UserRound' },
      ],
    },
    {
      key: 'sinifim',
      label: 'Sınıfım',
      icon: 'BarChart3',
      children: [
        { to: '/teacher/lesson-plan', label: 'Ders Planım', icon: 'CalendarRange' },
        { to: '/teacher/class-analysis', label: 'Sınıf Analizi', icon: 'BarChart3' },
      ],
    },
    canManageLibrary ? KUTUPHANE_TEACHER_ITEM : KITAPLIK_TEACHER_ITEM,
    { to: '/teacher/requests', label: 'Taleplerim', icon: 'ClipboardList' },
    { to: '/teacher/guide', label: 'Rehber', icon: 'BookOpen' },
  ]
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
    { to: '/parent/admin/pricing', label: 'Üyelik Paketleri', icon: 'Tag' },
  ],
}
