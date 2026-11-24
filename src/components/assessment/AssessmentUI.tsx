import { useOfferingRoute } from '@/services/use-offering-route'
import { useAssignment } from '@/services/use-assignment'
import { Link, NavLink } from 'react-router'
import { Status, Icon } from '@/components/ui'
import { LoadState } from '@/components/workspace/WorkspaceUI'
import type { AssignmentView } from '@/services/assessment-contracts'
import { formatInstant } from '@/services/presentation'
export function AssignmentNav({ view }: { view: AssignmentView }) {
  const { prefix } = useOfferingRoute()
  const a = view.assignment
  return (
    <>
      <div className="breadcrumb">
        <Link to={`/offerings/${a.offeringId}`}>{view.offeringLabel}</Link> /{' '}
        <Link to={`${prefix}/assignments`}>Assignments</Link> / {a.title}
      </div>
      <nav className="section-tabs" aria-label="Assignment navigation">
        <NavLink end to={`${prefix}/assignments/${a.id}`}>
          <Icon name="assignments" size={18} inheritColor />
          Assignment & submission
        </NavLink>
        {a.mode === 'GROUP' && (
          <NavLink to={`${prefix}/assignments/${a.id}/groups`}>
            {view.teacher ? 'Manage groups' : 'My group'}
          </NavLink>
        )}
        {view.teacher && (
          <NavLink to={`${prefix}/assignments/${a.id}/grading`}>
            <Icon name="gradebook" size={18} inheritColor />
            Grading
          </NavLink>
        )}
      </nav>
      {!view.writable && view.teacher && <Status>Read-only assignment or course section.</Status>}
    </>
  )
}
export function AssignmentLoad({ result }: { result: ReturnType<typeof useAssignment> }) {
  return (
    <LoadState
      loading={result.loading && !result.data}
      error={result.error}
      retry={result.reload}
    />
  )
}
export function Schedule({ view }: { view: AssignmentView }) {
  return (
    <dl className="assessment-schedule">
      <div>
        <dt>Open time</dt>
        <dd>{formatInstant(view.assignment.openAt)}</dd>
      </div>
      <div>
        <dt>Submission deadline</dt>
        <dd>{formatInstant(view.assignment.dueAt)}</dd>
      </div>
      <div>
        <dt>Submission lock time</dt>
        <dd>{formatInstant(view.assignment.cutoffAt)}</dd>
      </div>
    </dl>
  )
}
