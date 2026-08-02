import { createElement, lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import PanelLayout from '../layout/PanelLayout'
import ThemeProvider from '../../theme/ThemeProvider'
import LoadingState from '../shared/LoadingState'

const TodayPage = lazy(() => import('./pages/TodayPage'))
const WeeklyPlanPage = lazy(() => import('./pages/WeeklyPlanPage'))
const HomeworkPage = lazy(() => import('./pages/HomeworkPage'))
const TestsPage = lazy(() => import('./pages/TestsPage'))
const TestDetailPage = lazy(() => import('./pages/TestDetailPage'))
const MistakesPage = lazy(() => import('./pages/MistakesPage'))
const ProgressPage = lazy(() => import('./pages/ProgressPage'))

function pageElement(Page) {
  return (
    <Suspense fallback={<LoadingState label="Sayfa yükleniyor..." />}>
      {createElement(Page)}
    </Suspense>
  )
}

export default function StudentApp() {
  return (
    <ThemeProvider>
      <Routes>
        <Route element={<PanelLayout role="student" />}>
          <Route index element={<Navigate to="today" replace />} />
          <Route path="today" element={pageElement(TodayPage)} />
          <Route path="weekly-plan" element={pageElement(WeeklyPlanPage)} />
          <Route path="homework" element={pageElement(HomeworkPage)} />
          <Route path="tests" element={pageElement(TestsPage)} />
          <Route path="tests/:id" element={pageElement(TestDetailPage)} />
          <Route path="mistakes" element={pageElement(MistakesPage)} />
          <Route path="progress" element={pageElement(ProgressPage)} />
          <Route path="*" element={<Navigate to="today" replace />} />
        </Route>
      </Routes>
    </ThemeProvider>
  )
}
