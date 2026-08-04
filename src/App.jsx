import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { useAuth } from './context/useAuth'
import LoadingState from './panels/shared/LoadingState'

const LandingPage = lazy(() => import('./marketing/LandingPage'))
const AuthPage = lazy(() => import('./marketing/AuthPage'))
const PaywallPage = lazy(() => import('./marketing/PaywallPage'))
const StudentApp = lazy(() => import('./panels/student/StudentApp'))
const ParentApp = lazy(() => import('./panels/parent/ParentApp'))

const ALLOWED_ENTITLEMENT_STATUSES = new Set(['active', 'trial', 'grace_period'])

function panelPathForRole(role) {
  return role === 'ebeveyn' ? '/parent/dashboard' : '/student/today'
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

  if (authUser.role !== role) {
    return <Navigate to={panelPathForRole(authUser.role)} replace />
  }

  if (!authUser.isAdmin && !ALLOWED_ENTITLEMENT_STATUSES.has(authUser.entitlement?.status)) {
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
