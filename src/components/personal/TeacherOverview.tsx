import { Link } from 'react-router'
import { Icon, Panel, Status } from '@/components/ui'
import { OfferingCard } from '@/components/workspace/OfferingCard'
import type { services } from '@/services'
type View = Awaited<ReturnType<typeof services.personal.dashboard>>
export function TeacherOverview({ view }: { view: View }) {
  const isGrading = (task: View['tasks'][number]) =>
    task.kind === 'GRADING' ||
    task.kind === 'GRADE_ASSIGNMENT' ||
    task.href.endsWith('/grading') ||
    task.id.startsWith('grading-')
  const grading = view.tasks.filter(isGrading)
  const activities = view.tasks.filter((task) => !isGrading(task))
  return (
    <>
      <div className="dashboard-grid">
        <Panel title="Teaching sections">
          <div className="dashboard-courses">
            {view.sections.map((o) => (
              <OfferingCard offering={o} key={o.id} />
            ))}
          </div>
          {!view.sections.length && <Status>No teaching sections.</Status>}
        </Panel>
        <div>
          <Panel title="Grading queue" icon="gradebook">
            {grading.length ? (
              grading.map((task) => (
                <Link className="dashboard-task-row" to={task.href} key={task.id}>
                  <span className="resource-copy">
                    <strong>{task.title}</strong>
                    <span>{task.detail}</span>
                  </span>
                  <Icon name="nav-next" size={18} />
                </Link>
              ))
            ) : (
              <p>No assignments awaiting grading or publication.</p>
            )}
          </Panel>
          {activities.length > 0 && (
            <Panel title="Other activities" icon="document-small">
              {activities.map((task) => (
                <Link className="dashboard-task-row" to={task.href} key={task.id}>
                  <span className="resource-copy">
                    <strong>{task.title}</strong>
                    <span>{task.detail}</span>
                  </span>
                </Link>
              ))}
            </Panel>
          )}
        </div>
      </div>
      {view.announcements.length > 0 && (
        <Panel title="Class announcements" icon="announcements">
          {view.announcements.map((a) => (
            <p key={a.id}>
              <Link to={a.href}>{a.title}</Link>
            </p>
          ))}
        </Panel>
      )}
    </>
  )
}
