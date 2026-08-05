import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { useAuth } from './context/useAuth'
import LoadingState from './panels/shared/LoadingState'
import ConsentGate from './panels/shared/ConsentGate'

const LandingPage = lazy(() => import('./marketing/LandingPage'))
const AuthPage = lazy(() => import('./marketing/AuthPage'))
const PaywallPage = lazy(() => import('./marketing/PaywallPage'))
const StudentApp = lazy(() => import('./panels/student/StudentApp'))
const ParentApp = lazy(() => import('./panels/parent/ParentApp'))
const TeacherApp = lazy(() => import('./panels/teacher/TeacherApp'))

const ALLOWED_ENTITLEMENT_STATUSES = new Set(['active', 'trial', 'grace_period'])

function panelPathForRole(role) {
  if (role === 'ebeveyn') return '/parent/dashboard'
  if (role === 'ogretmen') return '/teacher/students'
  return '/student/today'
}

function RootRoute() {
  const { authUser, sessionLoading } = useAuth()

  if (sessionLoading) {
    return <LoadingState label="Oturum kontrol ediliyor..." fullScreen />
  }

  if (authUser?.role) {
    return <Navigate to={panelPathForRole(authUser.role)} replace />
  }

  // Native uygulama (iOS/Android) doğrudan giriş/üyelik sayfasını açar; pazarlama
  // sayfası yalnızca web'de görünür.
  if (Capacitor.isNativePlatform()) {
    return <Navigate to="/uye-ol" replace />
  }

  return <LandingPage />
}

function RequireRole({ role, children }) {
  const { authUser, sessionLoading } = useAuth()

  if (sessionLoading) {
    return <LoadingState label="Oturum kontrol ediliyor..." fullScreen />
  }

  if (!authUser) {
    return <Navigate to="/" replace />
  }

  // Öğretmen tarafından oluşturulan veli/öğrenci hesapları "onay bekliyor" durumunda açılır;
  // KVKK/aydınlatma onayı verilmeden panelin geri kalanına erişilemez.
  if (authUser.needsConsent) {
    return <ConsentGate />
  }

  if (authUser.role !== role) {
    return <Navigate to={panelPathForRole(authUser.role)} replace />
  }

  // Öğretmen ödeme yapan taraf değil (öğrencinin velisi ödüyor) — admin gibi paywall'dan muaf.
  // Admin bir üyenin panelini "Panele Giriş Yap" ile görüntülüyorsa (actingAdmin) da muaf tutulur.
  const bypassPaywall = authUser.isAdmin || authUser.role === 'ogretmen' || Boolean(authUser.actingAdmin)
  if (!bypassPaywall && !ALLOWED_ENTITLEMENT_STATUSES.has(authUser.entitlement?.status)) {
    return <Navigate to="/paywall" replace />
  }

  return children
}

export default function App() {
  return (
    <Suspense fallback={<LoadingState label="Sayfa yükleniyor..." fullScreen />}>
      <Routes>
        <Route path="/" element={<RootRoute />} />
        <Route path="/uye-ol" element={<AuthPage />} />
        <Route path="/paywall" element={<PaywallPage />} />
        <Route
          path="/student/*"
          element={
            <RequireRole role="ogrenci">
              <StudentApp />
            </RequireRole>
          }
        />
        <Route
          path="/parent/*"
          element={
            <RequireRole role="ebeveyn">
              <ParentApp />
            </RequireRole>
          }
        />
        <Route
          path="/teacher/*"
          element={
            <RequireRole role="ogretmen">
              <TeacherApp />
            </RequireRole>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
