import { useCallback } from 'react'
import { AdminOverview } from '@/components/personal/AdminOverview'
import { TeacherOverview } from '@/components/personal/TeacherOverview'
import { StudentOverview } from '@/components/personal/StudentOverview'
import { LoadState } from '@/components/workspace/WorkspaceUI'
import { services, apiMode } from '@/services'
import { MvpDashboard } from './MvpDashboard'
import { useAuth } from '@/services/auth-context'
import { useResource } from '@/services/use-resource'
const overview = { STUDENT: StudentOverview, INSTRUCTOR: TeacherOverview, ADMIN: AdminOverview }
const description = {
  STUDENT: 'What would you learn today?',
  INSTRUCTOR: 'Your teaching workspace',
  ADMIN: 'Account and course operations',
}
export function Dashboard() {
  return apiMode ? <MvpDashboard /> : <MockDashboard />
}
function MockDashboard() {
  const { identity } = useAuth(),
    account = identity!.me.account
  const load = useCallback(() => services.personal.dashboard(), [])
  const r = useResource(load, `dashboard:${account.id}`)
  const Overview = overview[account.role]
  return (
    <div className="course-workspace dashboard-workspace">
      <header>
        <h1>
          {account.role === 'ADMIN' ? 'Administrative overview' : `Welcome, ${account.displayName}`}
        </h1>
        <p>{description[account.role]}</p>
      </header>
      <LoadState {...r} retry={r.reload} />
      {r.data && !r.error && <Overview view={r.data} />}
    </div>
  )
}
