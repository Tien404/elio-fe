import { Link } from 'react-router'
import { DataTable, Panel, Status } from '@/components/ui'
import type { services } from '@/services'
type View = Awaited<ReturnType<typeof services.personal.dashboard>>
export function AdminOverview({ view }: { view: View }) {
  return (
    <>
      <div className="metric-grid">
        {['Accounts', 'Locked accounts', 'Open course sections', 'Operational audit entries'].map(
          (label, i) => (
            <div className="metric-card" key={label}>
              <div>
                <p>{label}</p>
                <strong>{view.metrics[i]}</strong>
              </div>
            </div>
          ),
        )}
      </div>
      <div className="dashboard-grid">
        <Panel title="Operational tasks" icon="info">
          <DataTable
            rows={view.tasks}
            rowKey={(t) => t.id}
            columns={[
              { label: 'Object', render: (t) => t.title },
              { label: 'Task', render: (t) => t.detail },
              { label: 'Action', render: (t) => <Link to={t.href}>Review</Link> },
            ]}
          />
          {!view.tasks.length && (
            <Status>No lead repairs or locked accounts requiring review.</Status>
          )}
          <div className="actions">
            <Link className="button secondary" to="/admin">
              Accounts
            </Link>
            <Link className="button primary" to="/offerings">
              Course administration
            </Link>
          </div>
        </Panel>
        <Panel title="Course-section operations" icon="book-small">
          <div className="actions">
            <Link className="button secondary" to="/offerings">
              View metadata
            </Link>
            <Link className="button primary" to="/admin?tab=audit">
              Audit log
            </Link>
          </div>
        </Panel>
      </div>
      <Panel title="Audit log" icon="info">
        <p>Search account and course-section operations by actor, action, object and reason.</p>
        <Link to="/admin?tab=audit">Open audit log for operational history</Link>
      </Panel>
    </>
  )
}
