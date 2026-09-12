import LessonNotesPage from '../shared/LessonNotesPage'
import { createElement, lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'
import { cachedGet } from '../../services/authClient'
import ThemeProvider from '../../theme/ThemeProvider'
import PanelLayout from '../layout/PanelLayout'
import LoadingState from '../shared/LoadingState'
import ParentTourProvider from './onboarding/ParentTourProvider'
import ParentStudentsGateContext from './parentStudentsGateContextObject'
import { useParentStudentsGate } from './useParentStudentsGate'

const GettingStartedPage = lazy(() => import('./pages/GettingStartedPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const WeeklyPlanPage = lazy(() => import('./pages/WeeklyPlanPage'))
const ProgressPage = lazy(() => import('./pages/ProgressPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const AdminUsersPage = lazy(() => import('./pages/AdminUsersPage'))
const AdminSubjectsPage = lazy(() => import('./pages/AdminSubjectsPage'))
const AdminPublishersPage = lazy(() => import('./pages/AdminPublishersPage'))
const AdminMotivationMessagesPage = lazy(() => import('./pages/AdminMotivationMessagesPage'))
const AdminGreetingsPage = lazy(() => import('./pages/AdminGreetingsPage'))
const AdminSchoolsPage = lazy(() => import('./pages/AdminSchoolsPage'))
const AdminPricingPage = lazy(() => import('./pages/AdminPricingPage'))
const StudentsPage = lazy(() => import('./pages/StudentsPage'))
const TeachersPage = lazy(() => import('./pages/TeachersPage'))
const LibraryPage = lazy(() => import('./pages/LibraryPage'))
const BookshelfPage = lazy(() => import('./pages/BookshelfPage'))
const RequestsPage = lazy(() => import('./pages/RequestsPage'))
const AdminBookRequestsPage = lazy(() => import('./pages/AdminBookRequestsPage'))
const TestsPage = lazy(() => import('./pages/TestsPage'))
const MistakesPage = lazy(() => import('./pages/MistakesPage'))
const StudyHistoryPage = lazy(() => import('./pages/StudyHistoryPage'))
const AiReportsPage = lazy(() => import('./pages/AiReportsPage'))
const MockExamsPage = lazy(() => import('./pages/MockExamsPage'))

function RequireAdmin({ children }) {
  const { authUser } = useAuth()
  return authUser?.isAdmin ? children : <Navigate to="/parent/dashboard" replace />
}

// Bugün/Haftalık Plan bir öğrenci bağlamı gerektirir; hiç çocuk profili eklenmemiş
// bir veli için bunlar yerine Çocuklarım'a yönlendirir (bkz. navConfig.getParentNav).
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
  // Menü adının "Çocuğum" / "Çocuklarım" arasında seçilmesi için (null = henüz bilinmiyor).
  const [studentCount, setStudentCount] = useState(null)

  // authUser.id'ye bağlı: admin bir veliyi impersonate edip /parent/dashboard'a geçtiğinde
  // ParentApp yeniden mount olmuyor, bu yüzden kimlik değiştiğinde yeniden fetch etmezsek
  // önceki kullanıcıya ait hasStudents değeri (ve dolayısıyla menü) yanlışlıkla kalıcı olur.
  useEffect(() => {
    let ignore = false
    cachedGet('/api/parent/students')
      .then((data) => {
        if (!ignore) {
          const count = (data.students || []).length
          setHasStudents(count > 0)
          setStudentCount(count)
        }
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
      studentCount,
      markHasStudents: () => setHasStudents(true),
    }),
    [studentsLoading, hasStudents, studentCount],
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
        <ParentTourProvider>
        <Routes>
          <Route element={<PanelLayout role="parent" />}>
            <Route path="admin/lesson-notes" element={<RequireAdmin><LessonNotesPage admin /></RequireAdmin>} />
            <Route path="lesson-notes" element={<LessonNotesPage />} />
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route
              path="dashboard"
              element={<RequireStudents>{pageElement(DashboardPage)}</RequireStudents>}
            />
            <Route
              path="weekly-plan"
              element={<RequireStudents>{pageElement(WeeklyPlanPage)}</RequireStudents>}
            />
            <Route
              path="progress"
              element={<RequireStudents>{pageElement(ProgressPage)}</RequireStudents>}
            />
            {/* Ödev/görev tekilleştirme (Faz 2): ayrı "Ödevler" sayfası kaldırıldı; ders-tipi
                görevler artık Haftalık Plan üzerinden yönetiliyor. Eski yer imleri yönlendirilir. */}
            <Route path="homework" element={<Navigate to="/parent/weekly-plan" replace />} />
            <Route path="tests" element={pageElement(TestsPage)} />
            <Route path="mistakes" element={pageElement(MistakesPage)} />
            <Route
              path="study-history"
              element={<RequireStudents>{pageElement(StudyHistoryPage)}</RequireStudents>}
            />
            <Route
              path="ai-reports"
              element={
                <RequireAdmin>
                  <RequireStudents>{pageElement(AiReportsPage)}</RequireStudents>
                </RequireAdmin>
              }
            />
            <Route
              path="mock-exams"
              element={<RequireStudents>{pageElement(MockExamsPage)}</RequireStudents>}
            />
            <Route path="students" element={pageElement(StudentsPage)} />
            <Route path="guide" element={pageElement(GettingStartedPage)} />
            <Route path="teachers" element={pageElement(TeachersPage)} />
            <Route
              path="library"
              element={<RequireStudents>{pageElement(LibraryPage)}</RequireStudents>}
            />
            <Route
              path="bookshelf"
              element={<RequireStudents>{pageElement(BookshelfPage)}</RequireStudents>}
            />
            <Route path="settings" element={pageElement(SettingsPage)} />
            <Route path="requests" element={pageElement(RequestsPage)} />
            <Route
              path="admin/book-requests"
              element={
                <RequireAdmin>
                  {pageElement(AdminBookRequestsPage)}
                </RequireAdmin>
              }
            />
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
              path="admin/pricing"
              element={
                <RequireAdmin>
                  {pageElement(AdminPricingPage)}
                </RequireAdmin>
              }
            />
            <Route path="*" element={<Navigate to="dashboard" replace />} />
          </Route>
        </Routes>
        </ParentTourProvider>
      </ParentStudentsGateProvider>
    </ThemeProvider>
  )
}
