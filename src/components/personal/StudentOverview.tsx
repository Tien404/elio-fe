import { OfferingCard } from '@/components/workspace/OfferingCard'
import { Link } from 'react-router'
import { Panel, Status, Icon } from '@/components/ui'
import { formatActivityReason } from '@/services/presentation'
import type { services } from '@/services'
type View = Awaited<ReturnType<typeof services.personal.dashboard>>
export function StudentOverview({ view }: { view: View }) {
  const completed = view.progress.reduce((n, r) => n + r.completed, 0)
  const total = view.progress.reduce((n, r) => n + r.total, 0)
  return (
    <>
      <div className="dashboard-grid">
        <Panel title="My courses" icon="book-small">
          <div className="dashboard-courses">
            {view.sections.map((o) => {
              const progress = view.progress.find((p) => p.offeringId === o.id)
              return (
                <OfferingCard key={o.id} offering={o}>
                  {progress?.percent != null ? (
                    <>
                      <span className="course-completion">
                        {progress.completed} / {progress.total} required · {progress.percent}%
                      </span>
                      <progress
                        aria-label={`${o.title} required progress`}
                        value={progress.completed}
                        max={progress.total}
                      />
                    </>
                  ) : (
                    <span className="course-completion">No required activities</span>
                  )}
                </OfferingCard>
              )
            })}
          </div>
          {!view.sections.length && <Status>No course sections in your current scope.</Status>}
        </Panel>
        <div>
          <Panel title="To do" icon="info">
            {view.tasks.slice(0, 8).map((t) => (
              <Link className="dashboard-task-row" to={t.href} key={t.id}>
                <span className="resource-icon">
                  <Icon
                    name={
                      t.id.startsWith('quiz')
                        ? 'quizzes'
                        : t.id.startsWith('assignment')
                          ? 'assignments'
                          : 'book-small'
                    }
                    size={22}
                  />
                </span>
                <span className="resource-copy">
                  <strong>{t.title}</strong>
                  <span>{formatActivityReason(t.detail)}</span>
                </span>
                <Icon name="nav-next" size={18} />
              </Link>
            ))}
            {!view.tasks.length && <p>No tasks requiring attention.</p>}
            {view.tasks.length > 8 && <Link to="/progress">View all activities</Link>}
          </Panel>
          <Panel title="Personal progress" icon="progress">
            <div className="dashboard-progress-summary">
              {total > 0 ? (
                <>
                  <strong>{view.metrics[3] === null ? '—' : `${view.metrics[3]}%`}</strong>
                  <p>
                    {completed} / {total} required activities completed
                  </p>
                  <progress aria-label="Overall required progress" value={completed} max={total} />
                </>
              ) : (
                <p>No required activities.</p>
              )}
            </div>
            <div className="actions">
              <Link className="button secondary" to="/progress">
                <Icon name="progress" size={18} />
                View progress
              </Link>
            </div>
          </Panel>
          {view.announcements.length > 0 && (
            <Panel title="Class announcements" icon="announcements">
              {view.announcements.map((a) => (
                <p key={a.id}>
                  <Link to={a.href}>{a.title}</Link>
                </p>
              ))}
            </Panel>
          )}
        </div>
      </div>
    </>
  )
}
