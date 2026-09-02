import { createElement, lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import ThemeProvider from '../../theme/ThemeProvider'
import PanelLayout from '../layout/PanelLayout'
import LoadingState from '../shared/LoadingState'
import { useAuth } from '../../context/useAuth'
import { getTeacherStudents } from '../../services/teacherService'
import TeacherClassesContext from './teacherClassesContextObject'

const StudentsPage = lazy(() => import('./pages/StudentsPage'))
const StudentDetailPage = lazy(() => import('./pages/StudentDetailPage'))
const ParentsPage = lazy(() => import('./pages/ParentsPage'))
const LessonPlanPage = lazy(() => import('./pages/LessonPlanPage'))
const LibraryPage = lazy(() => import('./pages/LibraryPage'))
const BookshelfPage = lazy(() => import('./pages/BookshelfPage'))
const ClassAnalysisPage = lazy(() => import('./pages/ClassAnalysisPage'))

function pageElement(Page) {
  return (
    <Suspense fallback={<LoadingState label="Sayfa yükleniyor..." />}>
      {createElement(Page)}
    </Suspense>
  )
}

// "Sınıf Analizi" menüsü + sekmeleri için: öğretmenin aktif öğrencilerinden türeyen
// sınıf listesi. authUser.id'ye bağlı yeniden fetch — admin bir öğretmeni impersonate
// ettiğinde TeacherApp remount olmuyor.
function TeacherClassesProvider({ children }) {
  const { authUser } = useAuth()
  const [state, setState] = useState({ loading: true, students: [] })

  useEffect(() => {
    let ignore = false
    getTeacherStudents('active')
      .then((data) => {
        if (!ignore) setState({ loading: false, students: Array.isArray(data) ? data : [] })
      })
      .catch(() => {
        if (!ignore) setState({ loading: false, students: [] })
      })
    return () => {
      ignore = true
    }
  }, [authUser?.id])

  const { loading: classesLoading, students } = state

  const value = useMemo(() => {
    const numericGrades = new Set()
    let hasUnspecified = false
    for (const student of students) {
      const raw = String(student?.studentGrade ?? '').trim()
      const num = Number(raw)
      if (raw && Number.isFinite(num)) numericGrades.add(num)
      else hasUnspecified = true
    }
    return {
      classesLoading,
      grades: Array.from(numericGrades).sort((a, b) => b - a),
      hasUnspecified,
      studentCount: students.length,
    }
  }, [students, classesLoading])

  return <TeacherClassesContext.Provider value={value}>{children}</TeacherClassesContext.Provider>
}

export default function TeacherApp() {
  return (
    <ThemeProvider fixedTheme="techcoach">
      <TeacherClassesProvider>
        <Routes>
          <Route element={<PanelLayout role="teacher" />}>
            <Route index element={<Navigate to="students" replace />} />
            <Route path="students" element={pageElement(StudentsPage)} />
            <Route path="students/:studentTeacherId" element={pageElement(StudentDetailPage)} />
            <Route path="parents" element={pageElement(ParentsPage)} />
            <Route path="lesson-plan" element={pageElement(LessonPlanPage)} />
            <Route path="library" element={pageElement(LibraryPage)} />
            <Route path="bookshelf" element={pageElement(BookshelfPage)} />
            <Route path="class-analysis" element={pageElement(ClassAnalysisPage)} />
            <Route path="*" element={<Navigate to="students" replace />} />
          </Route>
        </Routes>
      </TeacherClassesProvider>
    </ThemeProvider>
  )
}
