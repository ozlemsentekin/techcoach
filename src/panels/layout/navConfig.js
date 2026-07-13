export const STUDENT_PRIMARY_NAV = [
  { to: '/student/today', label: 'Bugün', icon: 'Home' },
  { to: '/student/weekly-plan', label: 'Haftalık Plan', icon: 'CalendarRange' },
  { to: '/student/tests', label: 'Testlerim', icon: 'ListChecks' },
  { to: '/student/progress', label: 'Gelişimim', icon: 'TrendingUp' },
]

export const STUDENT_MORE_NAV = [
  { to: '/student/homework', label: 'Ödevlerim', icon: 'NotebookPen' },
  { to: '/student/mistakes', label: 'Yanlışlarım', icon: 'AlertCircle' },
  { to: '/student/coach', label: 'Koçum', icon: 'Sparkles' },
  { to: '/student/settings', label: 'Ayarlar', icon: 'Settings' },
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
  { to: '/parent/students', label: 'Öğrenci Profillerim', icon: 'Users' },
  { to: '/parent/settings', label: 'Ayarlar', icon: 'Settings' },
]

export const PARENT_SIDEBAR_NAV = [...PARENT_PRIMARY_NAV, ...PARENT_MORE_NAV]
