import { createElement, lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'
import { authRequest } from '../../services/authClient'
import ThemeProvider from '../../theme/ThemeProvider'
import PanelLayout from '../layout/PanelLayout'
import LoadingState from '../shared/LoadingState'
import ParentStudentsGateContext from './parentStudentsGateContextObject'
import { useParentStudentsGate } from './useParentStudentsGate'

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
const AdminSchoolsPage = lazy(() => import('./pages/AdminSchoolsPage'))
const AdminMissingAnswerKeysPage = lazy(() => import('./pages/AdminMissingAnswerKeysPage'))
const StudentsPage = lazy(() => import('./pages/StudentsPage'))
const TeachersPage = lazy(() => import('./pages/TeachersPage'))
const LibraryPage = lazy(() => import('./pages/LibraryPage'))
const LibraryGradePage = lazy(() => import('./pages/LibraryGradePage'))
const HomeworkPage = lazy(() => import('./pages/HomeworkPage'))
const TestsPage = lazy(() => import('./pages/TestsPage'))
const MistakesPage = lazy(() => import('./pages/MistakesPage'))

function RequireAdmin({ children }) {
  const { authUser } = useAuth()
  return authUser?.isAdmin ? children : <Navigate to="/parent/dashboard" replace />
}

// Bugün/Haftalık Plan/Ödevler bir öğrenci bağlamı gerektirir; hiç çocuk profili eklenmemiş
// bir veli için bunlar yerine Çocuklarım'a yönlendirir (bkz. navConfig.getParentPrimaryNav).
function RequireStudents({ children }) {
  const { studentsLoading, hasStudents } = useParentStudentsGate()
  if (studentsLoading) {
    return <LoadingState label="Yükleniyor..." />
  }
  if (!hasStudents) {
    return <Navigate to="/parent/students" replace />
  }
  return children
}

function ParentStudentsGateProvider({ children }) {
  const { authUser } = useAuth()
  const [studentsLoading, setStudentsLoading] = useState(true)
  // Fetch tamamlanana kadar mevcut çoğunluk (zaten çocuğu olan) veliler için menüde
  // gereksiz bir yanıp sönme olmasın diye iyimser varsayılan true.
  const [hasStudents, setHasStudents] = useState(true)

  // authUser.id'ye bağlı: admin bir veliyi impersonate edip /parent/dashboard'a geçtiğinde
  // ParentApp yeniden mount olmuyor, bu yüzden kimlik değiştiğinde yeniden fetch etmezsek
  // önceki kullanıcıya ait hasStudents değeri (ve dolayısıyla menü) yanlışlıkla kalıcı olur.
  useEffect(() => {
    let ignore = false
    authRequest('/api/parent/students', { method: 'GET' })
      .then((data) => {
        if (!ignore) setHasStudents((data.students || []).length > 0)
      })
      .catch(() => {})
      .finally(() => {
        if (!ignore) setStudentsLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [authUser?.id])

  const value = useMemo(
    () => ({
      studentsLoading,
      hasStudents,
      markHasStudents: () => setHasStudents(true),
    }),
    [studentsLoading, hasStudents],
  )

  return <ParentStudentsGateContext.Provider value={value}>{children}</ParentStudentsGateContext.Provider>
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
    <ThemeProvider fixedTheme="techcoach">
      <ParentStudentsGateProvider>
        <Routes>
          <Route element={<PanelLayout role="parent" />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route
              path="dashboard"
              element={<RequireStudents>{pageElement(DashboardPage)}</RequireStudents>}
            />
            <Route
              path="weekly-plan"
              element={<RequireStudents>{pageElement(WeeklyPlanPage)}</RequireStudents>}
            />
            <Route path="progress" element={pageElement(ProgressPage)} />
            <Route path="messages" element={pageElement(MessagesPage)} />
            <Route
              path="homework"
              element={<RequireStudents>{pageElement(HomeworkPage)}</RequireStudents>}
            />
            <Route path="tests" element={pageElement(TestsPage)} />
            <Route path="mistakes" element={pageElement(MistakesPage)} />
            <Route path="students" element={pageElement(StudentsPage)} />
            <Route path="teachers" element={pageElement(TeachersPage)} />
            <Route
              path="library"
              element={<RequireStudents>{pageElement(LibraryPage)}</RequireStudents>}
            />
            <Route
              path="library/:grade"
              element={<RequireStudents>{pageElement(LibraryGradePage)}</RequireStudents>}
            />
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
            <Route
              path="admin/schools"
              element={
                <RequireAdmin>
                  {pageElement(AdminSchoolsPage)}
                </RequireAdmin>
              }
            />
            <Route
              path="admin/missing-answer-keys"
              element={
                <RequireAdmin>
                  {pageElement(AdminMissingAnswerKeysPage)}
                </RequireAdmin>
              }
            />
            <Route path="*" element={<Navigate to="dashboard" replace />} />
          </Route>
        </Routes>
      </ParentStudentsGateProvider>
    </ThemeProvider>
  )
}
