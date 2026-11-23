import { Link } from 'react-router'
import { DataTable, Panel, Status } from '@/components/ui'
import type { services } from '@/services'
type View = Awaited<ReturnType<typeof services.personal.dashboard>>
export function TeacherOverview({ view }: { view: View }) {
  const isGrading = (task: View['tasks'][number]) =>
    task.kind === 'GRADE_ASSIGNMENT' || task.id.startsWith('grading-')
  const grading = view.tasks.filter(isGrading)
  const activities = view.tasks.filter((task) => !isGrading(task))
  return (
    <>
      <div className="dashboard-grid">
        <Panel title="Teaching sections" icon="info">
          <div className="dashboard-courses">
            {view.sections.map((o) => (
              <Link className="dashboard-course" to={`/offerings/${o.id}`} key={o.id}>
                <div className="course-cover" aria-hidden="true" />
                <small>
                  {o.semester} · {o.courseCode} · {o.sectionCode}
                </small>
                <h3>{o.title}</h3>
                <p>{o.status}</p>
              </Link>
            ))}
          </div>
          {!view.sections.length && <Status>No teaching sections.</Status>}
        </Panel>
        <Panel title="Learning activities" icon="document-small">
          <DataTable
            rows={activities}
            rowKey={(t) => t.id}
            columns={[
              { label: 'Activity', render: (t) => t.title },
              { label: 'Next action', render: (t) => <Link to={t.href}>{t.detail}</Link> },
            ]}
          />
          {!activities.length && <p>No activities requiring attention.</p>}
          <div className="actions">
            <Link className="button secondary" to="/quizzes">
              Quizzes
            </Link>
            <Link className="button secondary" to="/progress">
              Progress
            </Link>
            <Link className="button primary" to="/calendar">
              Calendar
            </Link>
          </div>
        </Panel>
      </div>
      <Panel title="Grading queue" icon="info">
        <DataTable
          rows={grading}
          rowKey={(t) => t.id}
          columns={[
            { label: 'Activity', render: (t) => t.title },
            { label: 'Status', render: (t) => t.detail },
            {
              label: 'Action',
              render: (t) => (
                <Link className="button primary" to={t.href}>
                  Open grading
                </Link>
              ),
            },
          ]}
        />
        {!grading.length && <p>No grading decisions awaiting publication.</p>}
      </Panel>
      <Panel title="Class announcements" icon="messages">
        {view.announcements.map((a) => (
          <p key={a.id}>
            <Link to={a.href}>{a.title}</Link>
          </p>
        ))}
        {!view.announcements.length && <p>No published announcements.</p>}
        {view.sections
          .filter((o) => o.status !== 'ARCHIVED')
          .map((o) => (
            <p key={o.id}>
              <Link to={`/offerings/${o.id}/announcements`}>
                Manage announcements · {o.courseCode} · {o.sectionCode}
              </Link>
            </p>
          ))}
      </Panel>
    </>
  )
}
