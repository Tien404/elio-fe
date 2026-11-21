import { useAuth } from '@/services/auth-context'
import { useCallback, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Button, DataTable, Panel, Status } from '@/components/ui'
import { Badge, LoadState, Pager } from '@/components/workspace/WorkspaceUI'
import { AnnouncementsPanel } from '@/components/workspace/AnnouncementsPanel'
import { OfferingEditor } from '@/components/workspace/OfferingEditor'
import { OfferingTransition } from '@/components/workspace/OfferingTransition'
import { useOffering } from '@/pages/workspace/offering-context'
import type { OfferingView } from '@/services/course-contracts'
import { services } from '@/services'
import { useResource } from '@/services/use-resource'

export function Overview() {
  const { view, refreshing, reload } = useOffering(),
    o = view.offering,
    [edit, setEdit] = useState(false),
    [command, setCommand] = useState<'publish' | 'archive' | 'restore'>()
  return (
    <>
      <h1>Course overview</h1>
      <div className="overview-columns">
        <div>
          <Panel title={o.title} icon="info">
            <p>
              {o.courseCode} · {o.sectionCode} · {o.semester} · <Badge value={o.status} />
            </p>
            {view.permissions.academic && (
              <p className="material-body">
                {view.learningInformation || 'Learning information has not been added.'}
              </p>
            )}
            {view.permissions.repairLead && (
              <Status error>
                Restore requires an active lead instructor.
                <Link to={`/offerings/${o.id}/team`}> Review teaching team</Link>
              </Status>
            )}
            <div className="actions">
              {view.permissions.edit && (
                <Button tone="secondary" disabled={refreshing} onClick={() => setEdit(true)}>
                  Edit learning information
                </Button>
              )}
              {(['publish', 'archive', 'restore'] as const).map(
                (action) =>
                  view.permissions[action] && (
                    <Button
                      key={action}
                      tone="secondary"
                      disabled={refreshing}
                      onClick={() => setCommand(action)}
                    >
                      {action[0].toUpperCase() + action.slice(1)} section
                    </Button>
                  ),
              )}
            </div>
          </Panel>
          {view.permissions.academic ? (
            <>
              <LearningSummary view={view} />
              <AssignmentSummary id={o.id} />
              <AnnouncementsPanel
                offeringId={o.id}
                writable={view.permissions.teach}
                canPublish={view.permissions.teach && o.status === 'OPEN'}
              />
            </>
          ) : (
            <Panel title="Operational metadata only" icon="info">
              <p>
                Administrator access includes section state, membership metadata and staffing
                support. Private materials, announcements, submissions and grades require current
                academic membership.
              </p>
              <Link className="button secondary" to={`/offerings/${o.id}/team`}>
                Review teaching team
              </Link>
            </Panel>
          )}
        </div>
        <TeamSummary id={o.id} />
      </div>
      {edit && <OfferingEditor saved={view} close={() => setEdit(false)} />}
      {command && (
        <OfferingTransition
          item={view}
          command={command}
          close={() => setCommand(undefined)}
          reload={reload}
        />
      )}
    </>
  )
}
function LearningSummary({ view }: { view: OfferingView }) {
  const { identity } = useAuth()
  const student = identity!.me.account.role === 'STUDENT'
  const id = view.offering.id,
    [page, setPage] = useState(1),
    load = useCallback(
      () => services.content.materials(id, { page, status: 'PUBLISHED' }),
      [id, page],
    ),
    result = useResource(load, `overview-materials:${id}:${page}`)
  return (
    <Panel title="Published learning content" icon="book-small">
      <LoadState {...result} retry={result.reload} />
      {result.data && (
        <>
          {result.data.items.length ? (
            <DataTable
              rows={result.data.items}
              rowKey={(m) => m.resource.id}
              columns={[
                {
                  label: 'Activity',
                  render: (m) => (
                    <Link to={`/offerings/${id}/materials/${m.resource.id}`}>
                      {m.resource.title}
                    </Link>
                  ),
                },
                { label: 'Type', render: (m) => `${m.resource.kind.toLowerCase()} material` },
                {
                  label: student ? 'Completion' : 'Status',
                  render: (m) =>
                    student ? (m.completed ? 'Completed' : 'Not completed') : 'Published',
                },
              ]}
            />
          ) : (
            <Status>No published learning materials are available.</Status>
          )}
          <Pager value={result.data} change={setPage} />
        </>
      )}
      <div className="actions">
        <Link className="button secondary" to={`/offerings/${id}/materials`}>
          Topics and materials
        </Link>
        <Link className="button secondary" to={`/offerings/${id}/members`}>
          Members
        </Link>
        <Link className="button primary" to={`/offerings/${id}/team`}>
          Teaching team
        </Link>
      </div>
    </Panel>
  )
}
function TeamSummary({ id }: { id: number }) {
  const [page, setPage] = useState(1),
    load = useCallback(() => services.courses.team(id, { page }), [id, page]),
    result = useResource(load, `overview-team:${id}:${page}`)
  return (
    <aside>
      <Panel title="Instructor team" icon="people">
        <LoadState {...result} retry={result.reload} />
        {result.data && (
          <>
            {result.data.items
              .filter((m) => m.status === 'ACTIVE')
              .map((m) => (
                <article className="team-summary-person" key={m.id}>
                  <strong>{m.account.displayName}</strong>
                  <p>{m.teachingRole === 'LEAD' ? 'Lead instructor' : 'Co-instructor'}</p>
                  {m.account.status === 'LOCKED' && <Badge value="LOCKED" />}
                </article>
              ))}
            <Pager value={result.data} change={setPage} />
          </>
        )}
      </Panel>
    </aside>
  )
}
export function Announcements() {
  const { view } = useOffering()
  const [params, setParams] = useSearchParams()
  const linkedId = Number(params.get('announcementId')) || undefined
  return (
    <>
      <h1>Class announcements</h1>
      {view.permissions.academic ? (
        <AnnouncementsPanel
          key={view.offering.id}
          offeringId={view.offering.id}
          writable={view.permissions.teach}
          canPublish={view.permissions.teach && view.offering.status === 'OPEN'}
          linkedId={linkedId}
          clearLink={() => {
            if (linkedId)
              setParams(
                (current) => {
                  current.delete('announcementId')
                  return current
                },
                { replace: true },
              )
          }}
        />
      ) : (
        <Status error>Current academic membership is required.</Status>
      )}
    </>
  )
}

function AssignmentSummary({ id }: { id: number }) {
  const load = useCallback(
      () => services.assessment.list({ offeringId: id, status: 'PUBLISHED' }),
      [id],
    ),
    result = useResource(load, `overview-assignments:${id}`)
  return (
    <Panel title="Published assignments" icon="document-small">
      <LoadState {...result} retry={result.reload} />
      {result.data &&
        (result.data.items.length ? (
          <DataTable
            rows={result.data.items}
            rowKey={(v) => v.assignment.id}
            columns={[
              {
                label: 'Assignment',
                render: (v) => (
                  <Link to={`/offerings/${id}/assignments/${v.assignment.id}`}>
                    {v.assignment.title}
                  </Link>
                ),
              },
              { label: 'Mode', render: (v) => v.assignment.mode.toLowerCase() },
              {
                label: 'Status',
                render: (v) =>
                  v.teacher
                    ? 'Published'
                    : v.submission?.currentVersion
                      ? `Version ${v.submission.currentVersion.versionNo} · ${v.submission.currentVersion.isLate ? 'Late' : 'On time'}`
                      : v.assignment.mode === 'GROUP' && !v.group
                        ? 'Group not assigned'
                        : 'Not submitted',
              },
            ]}
          />
        ) : (
          <Status>No published assignments.</Status>
        ))}
      <Link className="button secondary" to={`/offerings/${id}/assignments`}>
        View all assignments
      </Link>
    </Panel>
  )
}
