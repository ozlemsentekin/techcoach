import { Navigate, Route, Routes } from 'react-router-dom'
import PanelLayout from '../layout/PanelLayout'
import ThemeProvider from '../../theme/ThemeProvider'
import TodayPage from './pages/TodayPage'
import WeeklyPlanPage from './pages/WeeklyPlanPage'
import HomeworkPage from './pages/HomeworkPage'
import TestsPage from './pages/TestsPage'
import TestDetailPage from './pages/TestDetailPage'
import MistakesPage from './pages/MistakesPage'
import ProgressPage from './pages/ProgressPage'

export default function StudentApp() {
  return (
    <ThemeProvider>
      <Routes>
        <Route element={<PanelLayout role="student" />}>
          <Route index element={<Navigate to="today" replace />} />
          <Route path="today" element={<TodayPage />} />
          <Route path="weekly-plan" element={<WeeklyPlanPage />} />
          <Route path="homework" element={<HomeworkPage />} />
          <Route path="tests" element={<TestsPage />} />
          <Route path="tests/:id" element={<TestDetailPage />} />
          <Route path="mistakes" element={<MistakesPage />} />
          <Route path="progress" element={<ProgressPage />} />
          <Route path="*" element={<Navigate to="today" replace />} />
        </Route>
      </Routes>
    </ThemeProvider>
  )
}
