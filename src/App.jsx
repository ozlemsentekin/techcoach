import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/useAuth'
import LandingPage from './marketing/LandingPage'
import LoadingState from './panels/shared/LoadingState'
import StudentApp from './panels/student/StudentApp'
import ParentApp from './panels/parent/ParentApp'

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

  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRoute />} />
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
  )
}
