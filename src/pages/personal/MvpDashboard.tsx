import { useCallback } from 'react'
import { Link } from 'react-router'
import { Panel, Status } from '@/components/ui'
import { LoadState } from '@/components/workspace/WorkspaceUI'
import { getMvpDashboard } from '@/services'
import { useResource } from '@/services/use-resource'
import { formatInstant } from '@/services/presentation'
export function MvpDashboard() {
  const load = useCallback(() => getMvpDashboard(), [])
  const result = useResource(load, 'mvp-dashboard')
  const view = result.data
  return (
    <div className="course-workspace">
      <h1>Dashboard</h1>
      <LoadState {...result} retry={result.reload} />
      {view && (
        <>
          <div className="metric-grid">
            {Object.entries(view.counts)
              .filter(([, value]) => value !== null)
              .map(([key, value]) => (
                <div className="metric-card" key={key}>
                  <div>
                    <p>
                      {{
                        accounts: 'Accounts',
                        lockedAccounts: 'Locked accounts',
                        openSections: 'Open course sections',
                        missingSubmissions: 'Assignments not submitted',
                      }[key] ?? key}
                    </p>
                    <strong>{value}</strong>
                  </div>
                </div>
              ))}
          </div>
          {view.role !== 'ADMIN' && (
            <>
              <Panel title="Course sections" icon="book-small">
                {view.sections.map((o) => (
                  <p key={o.id}>
                    <Link to={`/offerings/${o.id}`}>
                      {o.courseCode} · {o.sectionCode} · {o.title}
                    </Link>{' '}
                    · {o.status}
                  </p>
                ))}
                {!view.sections.length && <Status>No course sections.</Status>}
              </Panel>
              <Panel title="Published assignments" icon="assignments">
                {view.assignments.map((a) => (
                  <p key={a.id}>
                    <Link to={`/assignments/${a.id}`}>{a.title}</Link> · Due{' '}
                    {formatInstant(a.dueAt)}
                    {view.role === 'STUDENT' && ` · ${a.submitted ? 'Submitted' : 'Not submitted'}`}
                  </p>
                ))}
                {!view.assignments.length && <Status>No published assignments.</Status>}
              </Panel>
            </>
          )}
          <Panel title="Workspace" icon="info">
            <Link to="/offerings">Open course sections</Link>
            <p>
              Grading, results, quizzes, inbox, calendar and progress reports are not supported in
              MVP.
            </p>
          </Panel>
        </>
      )}
    </div>
  )
}
