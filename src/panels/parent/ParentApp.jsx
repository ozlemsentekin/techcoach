import { createElement, lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'
import ThemeProvider from '../../theme/ThemeProvider'
import PanelLayout from '../layout/PanelLayout'
import LoadingState from '../shared/LoadingState'

const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const WeeklyPlanPage = lazy(() => import('./pages/WeeklyPlanPage'))
const ProgressPage = lazy(() => import('./pages/ProgressPage'))
const MessagesPage = lazy(() => import('./pages/MessagesPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const AdminUsersPage = lazy(() => import('./pages/AdminUsersPage'))
const AdminSubjectsPage = lazy(() => import('./pages/AdminSubjectsPage'))
const AdminPublishersPage = lazy(() => import('./pages/AdminPublishersPage'))
const AdminMotivationMessagesPage = lazy(() => import('./pages/AdminMotivationMessagesPage'))
const AdminGreetingsPage = lazy(() => import('./pages/AdminGreetingsPage'))
const StudentsPage = lazy(() => import('./pages/StudentsPage'))
const HomeworkPage = lazy(() => import('./pages/HomeworkPage'))
const TestsPage = lazy(() => import('./pages/TestsPage'))
const MistakesPage = lazy(() => import('./pages/MistakesPage'))

function RequireAdmin({ children }) {
  const { authUser } = useAuth()
  return authUser?.isAdmin ? children : <Navigate to="/parent/dashboard" replace />
}

function pageElement(Page) {
  return (
    <Suspense fallback={<LoadingState label="Sayfa yükleniyor..." />}>
      {createElement(Page)}
    </Suspense>
  )
}

export default function ParentApp() {
  return (
    <ThemeProvider storageKey="parent_theme" defaultTheme="blue">
      <Routes>
        <Route element={<PanelLayout role="parent" />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={pageElement(DashboardPage)} />
          <Route path="weekly-plan" element={pageElement(WeeklyPlanPage)} />
          <Route path="progress" element={pageElement(ProgressPage)} />
          <Route path="messages" element={pageElement(MessagesPage)} />
          <Route path="homework" element={pageElement(HomeworkPage)} />
          <Route path="tests" element={pageElement(TestsPage)} />
          <Route path="mistakes" element={pageElement(MistakesPage)} />
          <Route path="students" element={pageElement(StudentsPage)} />
          <Route path="settings" element={pageElement(SettingsPage)} />
          <Route
            path="admin/users"
            element={
              <RequireAdmin>
                {pageElement(AdminUsersPage)}
              </RequireAdmin>
            }
          />
          <Route
            path="admin/subjects"
            element={
              <RequireAdmin>
                {pageElement(AdminSubjectsPage)}
              </RequireAdmin>
            }
          />
          <Route
            path="admin/publishers"
            element={
              <RequireAdmin>
                {pageElement(AdminPublishersPage)}
              </RequireAdmin>
            }
          />
          <Route
            path="admin/motivation-messages"
            element={
              <RequireAdmin>
                {pageElement(AdminMotivationMessagesPage)}
              </RequireAdmin>
            }
          />
          <Route
            path="admin/greetings"
            element={
              <RequireAdmin>
                {pageElement(AdminGreetingsPage)}
              </RequireAdmin>
            }
          />
          <Route path="*" element={<Navigate to="dashboard" replace />} />
        </Route>
      </Routes>
    </ThemeProvider>
  )
}
