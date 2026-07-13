import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'
import PanelLayout from '../layout/PanelLayout'
import DashboardPage from './pages/DashboardPage'
import WeeklyPlanPage from './pages/WeeklyPlanPage'
import ProgressPage from './pages/ProgressPage'
import MessagesPage from './pages/MessagesPage'
import SettingsPage from './pages/SettingsPage'
import AdminUsersPage from './pages/AdminUsersPage'
import StudentsPage from './pages/StudentsPage'
import HomeworkPage from './pages/HomeworkPage'
import TestsPage from './pages/TestsPage'
import MistakesPage from './pages/MistakesPage'

function RequireAdmin({ children }) {
  const { authUser } = useAuth()
  return authUser?.isAdmin ? children : <Navigate to="/parent/dashboard" replace />
}

export default function ParentApp() {
  return (
    <Routes>
      <Route element={<PanelLayout role="parent" />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="weekly-plan" element={<WeeklyPlanPage />} />
        <Route path="progress" element={<ProgressPage />} />
        <Route path="messages" element={<MessagesPage />} />
        <Route path="homework" element={<HomeworkPage />} />
        <Route path="tests" element={<TestsPage />} />
        <Route path="mistakes" element={<MistakesPage />} />
        <Route path="students" element={<StudentsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route
          path="admin/users"
          element={
            <RequireAdmin>
              <AdminUsersPage />
            </RequireAdmin>
          }
        />
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Route>
    </Routes>
  )
}
