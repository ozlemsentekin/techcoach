export function panelPathForRole(role) {
  if (role === 'ebeveyn') return '/parent/dashboard'
  if (role === 'ogretmen') return '/teacher/students'
  return '/student/today'
}
