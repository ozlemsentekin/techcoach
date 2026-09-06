import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { useAuth } from './context/useAuth'
import LoadingState from './panels/shared/LoadingState'
import ConsentGate from './panels/shared/ConsentGate'
import { panelPathForRole } from './utils/panelPath'

const LandingPage = lazy(() => import('./marketing/LandingPage'))
const AuthPage = lazy(() => import('./marketing/AuthPage'))
const SignUpPage = lazy(() => import('./marketing/SignUpPage'))
const PaywallPage = lazy(() => import('./marketing/PaywallPage'))
const PaymentPage = lazy(() => import('./marketing/PaymentPage'))
const PaymentResultPage = lazy(() => import('./marketing/PaymentResultPage'))
const LegalPage = lazy(() => import('./marketing/LegalPage'))
const StudentApp = lazy(() => import('./panels/student/StudentApp'))
const ParentApp = lazy(() => import('./panels/parent/ParentApp'))
const TeacherApp = lazy(() => import('./panels/teacher/TeacherApp'))

function RootRoute() {
  const { authUser, sessionLoading } = useAuth()

  if (sessionLoading) {
    return <LoadingState label="Oturum kontrol ediliyor..." fullScreen />
  }

  if (authUser?.role) {
    return <Navigate to={panelPathForRole(authUser.role)} replace />
  }

  // Native uygulama (iOS/Android) doğrudan giriş sayfasını açar; pazarlama
  // sayfası yalnızca web'de görünür.
  if (Capacitor.isNativePlatform()) {
    return <Navigate to="/login" replace />
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

  // Ödeme gecikmesi artık sert kilit değil: hesap panele girer, uyarı bandı gösterilir ve
  // ödeme çözülene kadar yeni görev ekleme kapanır (bkz. BillingBanner / BillingGateProvider).
  return children
}

export default function App() {
  return (
    <Suspense fallback={<LoadingState label="Sayfa yükleniyor..." fullScreen />}>
      <Routes>
        <Route path="/" element={<RootRoute />} />
        <Route path="/login" element={<AuthPage />} />
        <Route path="/uye-ol" element={<SignUpPage />} />
        <Route path="/paywall" element={<PaywallPage />} />
        <Route path="/odeme" element={<PaymentPage />} />
        <Route path="/odeme/sonuc" element={<PaymentResultPage />} />
        <Route path="/hakkimizda" element={<LegalPage slug="hakkimizda" />} />
        <Route path="/gizlilik-sozlesmesi" element={<LegalPage slug="gizlilik" />} />
        <Route path="/mesafeli-satis-sozlesmesi" element={<LegalPage slug="mesafeliSatis" />} />
        <Route path="/teslimat-iade-sartlari" element={<LegalPage slug="teslimatIade" />} />
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
