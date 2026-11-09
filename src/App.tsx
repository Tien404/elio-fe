import { apiMode } from '@/services'
import { Spinner } from '@/components/LoadingBoundary'
import { lazy, Suspense } from 'react'
import { Assignments } from '@/pages/assessment/Assignments'
import { AssignmentDetail } from '@/pages/assessment/AssignmentDetail'
import { Groups } from '@/pages/assessment/Groups'
import { Grading } from '@/pages/assessment/Grading'
import { Results } from '@/pages/assessment/Results'
import { Catalog, CatalogDetail } from '@/pages/workspace/Catalog'
import { Offerings } from '@/pages/workspace/Offerings'
import { OfferingLayout } from '@/pages/workspace/OfferingLayout'
import { Overview, Announcements } from '@/pages/workspace/Overview'
import { Materials } from '@/pages/workspace/Materials'
import { Members } from '@/pages/workspace/Members'
import { Team } from '@/pages/workspace/Team'
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router'
import { AuthProvider } from '@/components/AuthProvider'
import { DemoControls } from '@/components/DemoControls'
import { Shell } from '@/components/Shell'
import { Button, Status } from '@/components/ui'
import { Login } from '@/pages/Login'
import { Profile } from '@/pages/Profile'
import { ChangePassword } from '@/pages/ChangePassword'
import { NotFound } from '@/pages/Module'
import { useAuth } from '@/services/auth-context'

const Dashboard = lazy(() =>
  import('@/pages/personal/Dashboard').then((m) => ({ default: m.Dashboard })),
)
const Inbox = lazy(() => import('@/pages/personal/Inbox').then((m) => ({ default: m.Inbox })))
const Calendar = lazy(() =>
  import('@/pages/personal/Calendar').then((m) => ({ default: m.Calendar })),
)
const Progress = lazy(() =>
  import('@/pages/personal/Progress').then((m) => ({ default: m.Progress })),
)
const Admin = lazy(() => import('@/pages/personal/Admin').then((m) => ({ default: m.Admin })))
const Quizzes = lazy(() => import('@/pages/quiz/Quizzes').then((m) => ({ default: m.Quizzes })))
const QuestionBank = lazy(() =>
  import('@/pages/quiz/QuestionBank').then((m) => ({ default: m.QuestionBank })),
)
const QuizDetail = lazy(() =>
  import('@/pages/quiz/QuizDetail').then((m) => ({ default: m.QuizDetail })),
)
const QuizAttempt = lazy(() =>
  import('@/pages/quiz/QuizAttempt').then((m) => ({ default: m.QuizAttempt })),
)
const QuizAttempts = lazy(() =>
  import('@/pages/quiz/QuizAttempts').then((m) => ({ default: m.QuizAttempts })),
)
function Guard({ restricted = false }: { restricted?: boolean }) {
  const auth = useAuth()
  const location = useLocation()
  if (auth.loading)
    return (
      <div className="startup">
        <Spinner />
      </div>
    )
  if (auth.restoreError)
    return (
      <div className="startup">
        <Status error>{auth.restoreError}</Status>
        <Button onClick={() => void auth.refresh()}>Retry</Button>
      </div>
    )
  if (!auth.identity)
    return (
      <Navigate
        to="/login"
        state={{ from: location.pathname + location.search + location.hash }}
        replace
      />
    )
  if (auth.identity.session.restricted && !restricted)
    return <Navigate to="/change-password" replace />
  return <Outlet />
}
function PasswordRoute() {
  const { identity } = useAuth()
  return identity!.session.restricted ? <ChangePassword /> : <Shell />
}
function Unsupported() {
  return (
    <div className="course-workspace">
      <h1>Available after MVP</h1>
      <Status>This feature is not supported yet.</Status>
    </div>
  )
}
function App() {
  return (
    <AuthProvider>
      <Suspense fallback={<Spinner />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<Guard restricted />}>
            <Route element={<PasswordRoute />}>
              <Route path="/change-password" element={<ChangePassword />} />
            </Route>
          </Route>
          <Route element={<Guard />}>
            <Route element={<Shell />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/courses" element={<Catalog />} />
              <Route path="/courses/:courseId" element={<CatalogDetail />} />
              <Route path="/offerings" element={<Offerings />} />
              <Route path="/offerings/new" element={<Offerings create />} />
              <Route path="/offerings/join" element={<Offerings joining />} />
              <Route path="/offerings/:offeringId" element={<OfferingLayout />}>
                <Route index element={<Overview />} />
                <Route path="materials" element={<Materials />} />
                <Route path="materials/:materialId" element={<Materials />} />
                <Route path="members" element={<Members />} />
                <Route path="team" element={<Team />} />
                <Route
                  path="announcements"
                  element={apiMode ? <Unsupported /> : <Announcements />}
                />
              </Route>
              <Route path="/assignments" element={<Assignments />} />
              <Route path="/assignments/:assignmentId" element={<AssignmentDetail />} />
              <Route
                path="/assignments/:assignmentId/groups"
                element={apiMode ? <Unsupported /> : <Groups />}
              />
              <Route
                path="/assignments/:assignmentId/grading"
                element={apiMode ? <Unsupported /> : <Grading />}
              />
              <Route path="/results" element={apiMode ? <Unsupported /> : <Results />} />
              <Route path="/quizzes" element={apiMode ? <Unsupported /> : <Quizzes />} />
              <Route path="/question-bank" element={apiMode ? <Unsupported /> : <QuestionBank />} />
              <Route path="/quizzes/:quizId" element={apiMode ? <Unsupported /> : <QuizDetail />} />
              <Route
                path="/quizzes/:quizId/attempts"
                element={apiMode ? <Unsupported /> : <QuizAttempts />}
              />
              <Route
                path="/quiz-attempts/:attemptId"
                element={apiMode ? <Unsupported /> : <QuizAttempt />}
              />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/notifications" element={apiMode ? <Unsupported /> : <Inbox />} />
              <Route path="/calendar" element={apiMode ? <Unsupported /> : <Calendar />} />
              <Route path="/progress" element={apiMode ? <Unsupported /> : <Progress />} />
              <Route path="/admin" element={apiMode ? <Unsupported /> : <Admin />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Route>
        </Routes>
      </Suspense>
      <DemoControls />
    </AuthProvider>
  )
}
export default App
