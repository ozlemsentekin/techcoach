import LessonNotesPage from '../shared/LessonNotesPage'
import { createElement, lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import PanelLayout from '../layout/PanelLayout'
import ThemeProvider from '../../theme/ThemeProvider'
import { DEFAULT_THEME, isValidTheme } from '../../theme/themes'
import { useAuth } from '../../context/useAuth'
import LoadingState from '../shared/LoadingState'

const TodayPage = lazy(() => import('./pages/TodayPage'))
const WeeklyPlanPage = lazy(() => import('./pages/WeeklyPlanPage'))
const CoursesPage = lazy(() => import('./pages/CoursesPage'))
const MistakesPage = lazy(() => import('./pages/MistakesPage'))
const ProgressPage = lazy(() => import('./pages/ProgressPage'))
const StudyHistoryPage = lazy(() => import('./pages/StudyHistoryPage'))
const AiReportsPage = lazy(() => import('./pages/AiReportsPage'))
const MockExamsPage = lazy(() => import('./pages/MockExamsPage'))
const TeachersPage = lazy(() => import('./pages/TeachersPage'))
const GuidePage = lazy(() => import('../shared/GuidePage'))
const RequestsPage = lazy(() => import('./pages/RequestsPage'))

function pageElement(Page) {
  return (
    <Suspense fallback={<LoadingState label="Sayfa yükleniyor..." />}>
      {createElement(Page)}
    </Suspense>
  )
}

export default function StudentApp() {
  const { authUser } = useAuth()
  const defaultTheme = isValidTheme(authUser?.themeId) ? authUser.themeId : DEFAULT_THEME

  return (
    <ThemeProvider defaultTheme={defaultTheme}>
      <Routes>
        <Route element={<PanelLayout role="student" />}>
          <Route path="lesson-notes" element={<LessonNotesPage />} />
            <Route index element={<Navigate to="today" replace />} />
          <Route path="today" element={pageElement(TodayPage)} />
          <Route path="weekly-plan" element={pageElement(WeeklyPlanPage)} />
          <Route path="courses" element={pageElement(CoursesPage)} />
          <Route path="teachers" element={pageElement(TeachersPage)} />
          <Route path="requests" element={pageElement(RequestsPage)} />
            <Route path="guide" element={pageElement(GuidePage)} />
          {/* Ödev/görev tekilleştirme (Faz 2): ayrı "Ödevlerim" sayfası kaldırıldı; ders-tipi
              görevler artık Haftalık Plan üzerinden yönetiliyor. Eski yer imleri yönlendirilir. */}
          <Route path="homework" element={<Navigate to="/student/weekly-plan" replace />} />
          {/* Kitaplık öğrenci panelinde gösterilmez; eski yer imleri Bugün'e yönlendirilir. */}
          <Route path="bookshelf" element={<Navigate to="today" replace />} />
          <Route path="mistakes" element={pageElement(MistakesPage)} />
          <Route path="study-history" element={pageElement(StudyHistoryPage)} />
          {/* AI Raporları şimdilik yalnızca admin'e bağlı öğrenci profilinde. */}
          <Route
            path="ai-reports"
            element={authUser?.aiReportsEnabled ? pageElement(AiReportsPage) : <Navigate to="today" replace />}
          />
          <Route path="mock-exams" element={pageElement(MockExamsPage)} />
          <Route path="progress" element={pageElement(ProgressPage)} />
          <Route path="*" element={<Navigate to="today" replace />} />
        </Route>
      </Routes>
    </ThemeProvider>
  )
}
