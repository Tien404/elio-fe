import { Link } from 'react-router'
import { DataTable, Panel, Status } from '@/components/ui'
import { calendarKindLabel } from '@/services/calendar-view'
import { formatInstant } from '@/services/presentation'
import { useCallback } from 'react'
import { AdminOverview } from '@/components/personal/AdminOverview'
import { TeacherOverview } from '@/components/personal/TeacherOverview'
import { StudentOverview } from '@/components/personal/StudentOverview'
import { LoadState } from '@/components/workspace/WorkspaceUI'
import { services } from '@/services'
import { useAuth } from '@/services/auth-context'
import { useResource } from '@/services/use-resource'
const overview = { STUDENT: StudentOverview, INSTRUCTOR: TeacherOverview, ADMIN: AdminOverview }
export function Dashboard() {
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
      </header>
      <LoadState {...r} retry={r.reload} />
      {r.data && !r.error && (
        <>
          <Overview view={r.data} />
          {account.role !== 'ADMIN' && (
            <Panel
              title="Upcoming deadlines"
              icon="calendar"
              actions={
                <Link className="button secondary" to="/calendar?view=list">
                  Open calendar
                </Link>
              }
            >
              {r.data.upcoming.length ? (
                <DataTable
                  rows={r.data.upcoming.slice(0, 8)}
                  rowKey={(event) => event.id}
                  columns={[
                    {
                      label: 'Activity',
                      render: (event) => <Link to={event.targetUri}>{event.title}</Link>,
                    },
                    { label: 'Course section', render: (event) => event.section },
                    { label: 'Event', render: (event) => calendarKindLabel[event.kind] },
                    { label: 'Time', render: (event) => formatInstant(event.at) },
                  ]}
                />
              ) : (
                <Status>No activities scheduled for the next seven days.</Status>
              )}
            </Panel>
          )}
        </>
      )}
    </div>
  )
}
