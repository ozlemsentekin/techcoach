import { createElement, lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import ThemeProvider from '../../theme/ThemeProvider'
import PanelLayout from '../layout/PanelLayout'
import LoadingState from '../shared/LoadingState'

const StudentsPage = lazy(() => import('./pages/StudentsPage'))
const StudentDetailPage = lazy(() => import('./pages/StudentDetailPage'))
const ParentsPage = lazy(() => import('./pages/ParentsPage'))
const LessonPlanPage = lazy(() => import('./pages/LessonPlanPage'))

function pageElement(Page) {
  return (
    <Suspense fallback={<LoadingState label="Sayfa yükleniyor..." />}>
      {createElement(Page)}
    </Suspense>
  )
}

export default function TeacherApp() {
  return (
    <ThemeProvider fixedTheme="techcoach">
      <Routes>
        <Route element={<PanelLayout role="teacher" />}>
          <Route index element={<Navigate to="students" replace />} />
          <Route path="students" element={pageElement(StudentsPage)} />
          <Route path="students/:studentTeacherId" element={pageElement(StudentDetailPage)} />
          <Route path="parents" element={pageElement(ParentsPage)} />
          <Route path="lesson-plan" element={pageElement(LessonPlanPage)} />
          <Route path="*" element={<Navigate to="students" replace />} />
        </Route>
      </Routes>
    </ThemeProvider>
  )
}
