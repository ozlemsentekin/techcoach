import { Navigate, Route, Routes } from 'react-router-dom'
import PanelLayout from '../layout/PanelLayout'
import DashboardPage from './pages/DashboardPage'
import WeeklyPlanPage from './pages/WeeklyPlanPage'
import ProgressPage from './pages/ProgressPage'
import MessagesPage from './pages/MessagesPage'
import SettingsPage from './pages/SettingsPage'

export default function ParentApp() {
  return (
    <Routes>
      <Route element={<PanelLayout role="parent" />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="weekly-plan" element={<WeeklyPlanPage />} />
        <Route path="progress" element={<ProgressPage />} />
        <Route path="messages" element={<MessagesPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Route>
    </Routes>
  )
}
