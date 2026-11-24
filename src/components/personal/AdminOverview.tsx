import { Link } from 'react-router'
import { Icon, Panel } from '@/components/ui'
import { apiMode, type services } from '@/services'
type View = Awaited<ReturnType<typeof services.personal.dashboard>>
export function AdminOverview({ view }: { view: View }) {
  const metrics = [
    { label: 'Accounts', icon: 'people-duotone' },
    { label: 'Locked accounts', icon: 'lock-duotone' },
    { label: 'Open course sections', icon: 'metric-courses' },
    ...(apiMode ? [] : [{ label: 'Operational audit entries', icon: 'metric-progress' }]),
  ]
  return (
    <>
      <div className="metric-grid">
        {metrics.map(({ label, icon }, i) => (
          <div className="metric-card" key={label}>
            <span className="metric-artwork">
              <Icon name={icon} size="100%" inheritColor={false} />
            </span>
            <div>
              <p>{label}</p>
              <strong>{view.metrics[i]}</strong>
            </div>
          </div>
        ))}
      </div>
      <Panel title="Administration" icon="people">
        <div className="actions">
          <Link className="button secondary" to="/admin">
            Accounts
          </Link>
          <Link className="button secondary" to="/offerings">
            Course sections
          </Link>
          <Link className="button secondary" to="/courses">
            Course catalog
          </Link>
          <Link className="button secondary" to="/admin?tab=audit">
            Audit log
          </Link>
        </div>
      </Panel>
    </>
  )
}
