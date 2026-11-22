import { OfferingCard } from '@/components/workspace/OfferingCard'
import { Link } from 'react-router'
import { Panel, Status, Icon } from '@/components/ui'
import { apiMode } from '@/services'
import { formatActivityReason } from '@/services/presentation'
import type { services } from '@/services'
type View = Awaited<ReturnType<typeof services.personal.dashboard>>
const metrics = [
  { label: 'Course sections', icon: 'metric-courses', detail: 'Open sections' },
  {
    label: 'Missing submissions',
    icon: 'metric-assignments',
    detail: apiMode ? 'Open submission windows' : 'Required assignments',
  },
  {
    label: 'Quizzes to complete',
    icon: 'metric-quizzes',
    detail: apiMode ? 'Available attempts' : 'Required quizzes',
  },
  { label: 'Required progress', icon: 'metric-progress', detail: 'Activity completion' },
]
export function StudentOverview({ view }: { view: View }) {
  return (
    <>
      <div className="metric-grid">
        {metrics.map(({ label, icon, detail }, i) => (
          <div className="metric-card" key={label}>
            <span className={`metric-artwork ${icon}`}>
              <Icon name={icon} size="100%" inheritColor={false} />
            </span>
            <div>
              <p>{label}</p>
              <strong>
                {view.metrics[i] === null ? '—' : `${view.metrics[i]}${i === 3 ? '%' : ''}`}
              </strong>
              <small>{detail}</small>
            </div>
          </div>
        ))}
      </div>
      <div className="dashboard-grid">
        <Panel title="My learning courses" icon="book-small">
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
        <Panel title="Tasks requiring attention" icon="info">
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
          <div className="actions panel-footer-actions">
            <Link className="button secondary" to="/calendar">
              <Icon name="calendar" size={18} />
              Calendar
            </Link>
            <Link className="button secondary" to="/assignments">
              <Icon name="assignments" size={18} />
              Assignments
            </Link>
            <Link className="button secondary" to="/quizzes">
              <Icon name="quizzes" size={18} />
              Quizzes
            </Link>
          </div>
          {view.tasks.length > 8 && <p>More activities are available in Progress.</p>}
        </Panel>
        <Panel title="Class announcements" icon="messages">
          {view.announcements.map((a) => (
            <p key={a.id}>
              <Link to={a.href}>{a.title}</Link>
            </p>
          ))}
          {!view.announcements.length && <p>No published announcements.</p>}
        </Panel>
        <Panel title="Personal progress" icon="progress">
          <div className="dashboard-progress-summary">
            <strong>{view.metrics[3] === null ? '—' : `${view.metrics[3]}%`}</strong>
            <p>
              {view.progress.reduce((n, r) => n + r.completed, 0)} /{' '}
              {view.progress.reduce((n, r) => n + r.total, 0)} required activities completed
            </p>
            {view.metrics[3] === null ? (
              <p>No required activities.</p>
            ) : (
              <progress
                aria-label="Overall required progress"
                value={view.progress.reduce((n, r) => n + r.completed, 0)}
                max={view.progress.reduce((n, r) => n + r.total, 0)}
              />
            )}
          </div>
          <div className="actions panel-footer-actions">
            <Link className="button secondary" to="/notifications">
              <Icon name="notifications" size={18} />
              Inbox{view.unread > 0 ? ` (${view.unread})` : ''}
            </Link>
            <Link className="button secondary" to="/progress">
              <Icon name="progress" size={18} />
              View progress
            </Link>
          </div>
        </Panel>
      </div>
    </>
  )
}
