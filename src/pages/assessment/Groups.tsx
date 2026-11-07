import { ActionButton as Button } from '@/components/workspace/WorkspaceUI'
import { useAssignment } from '@/services/use-assignment'
import { useCallback, useState } from 'react'
import { DataTable, Panel, Status } from '@/components/ui'
import { LoadState, Pager, Badge } from '@/components/workspace/WorkspaceUI'
import { AssignmentNav, AssignmentLoad } from '@/components/assessment/AssessmentUI'
import { GroupEditor } from '@/components/assessment/GroupEditor'
import { services } from '@/services'
import { useResource } from '@/services/use-resource'
import { useAuth } from '@/services/auth-context'
import type { GroupView } from '@/services/assessment-contracts'
import { formatInstant } from '@/services/presentation'
import { WorkspaceAccessContext } from '@/services/workspace-access-context'
export function Groups() {
  const assignment = useAssignment(),
    view = assignment.data,
    { identity } = useAuth(),
    id = view?.assignment.id ?? 0,
    [page, setPage] = useState(1),
    [editor, setEditor] = useState<GroupView | null | undefined>(),
    load = useCallback(
      () => (id ? services.assessment.groups(id, { page }) : Promise.resolve(null)),
      [id, page],
    ),
    result = useResource(load, `groups:${identity!.me.account.id}:${id}:${page}`)
  return (
    <div className="course-workspace">
      <h1>{view?.teacher ? 'Assignment group management' : 'My assignment group'}</h1>
      <AssignmentLoad result={assignment} />
      {view && (
        <WorkspaceAccessContext.Provider
          value={
            assignment.error ? { error: assignment.error, retry: assignment.reload } : undefined
          }
        >
          <div
            className={assignment.error ? 'offering-content permission-lost' : 'offering-content'}
          >
            <AssignmentNav view={view} />
            <Panel title="Groups for assignment" icon="people-small">
              <p>
                {view.offeringLabel} · {view.assignment.title}
              </p>
              <LoadState {...result} retry={result.reload} />
              {result.data &&
                (result.data.items.length ? (
                  <>
                    <DataTable
                      rows={result.data.items}
                      rowKey={(g) => g.group.id}
                      columns={[
                        { label: 'Group', render: (g) => g.group.name },
                        {
                          label: 'Members',
                          render: (g) => (
                            <ul>
                              {g.members.map((m) => (
                                <li key={m.id}>
                                  {m.displayName} · {m.id} · <Badge value={m.status} />
                                </li>
                              ))}
                            </ul>
                          ),
                        },
                        {
                          label: 'Recipients',
                          render: (g) =>
                            g.group.lockedAt ? (
                              <>
                                Finalized · {formatInstant(g.group.lockedAt)}
                                <small>
                                  {g.frozenRecipients.map((r) => r.displayName).join(', ')}
                                </small>
                              </>
                            ) : (
                              'Not finalized'
                            ),
                        },
                        {
                          label: 'Actions',
                          render: (g) =>
                            view.teacher && view.writable && !g.group.lockedAt ? (
                              <Button icon="edit" tone="secondary" onClick={() => setEditor(g)}>
                                Edit group
                              </Button>
                            ) : g.group.lockedAt ? (
                              'Frozen'
                            ) : (
                              'Shared submission available to every eligible member'
                            ),
                        },
                      ]}
                    />
                    <Pager value={result.data} change={setPage} />
                  </>
                ) : (
                  <Status>
                    {view.teacher
                      ? 'No groups yet. Create a group and assign students.'
                      : 'You have not been assigned to a group. Ask your instructor to assign you before submitting.'}
                  </Status>
                ))}
              {view.teacher && view.writable && view.assignment.mode === 'GROUP' && (
                <Button icon="add" tone="secondary" onClick={() => setEditor(null)}>
                  Create group
                </Button>
              )}
            </Panel>
            {editor !== undefined && (
              <GroupEditor
                assignmentId={id}
                group={editor ?? undefined}
                close={() => {
                  setEditor(undefined)
                  result.reload()
                }}
              />
            )}
          </div>
        </WorkspaceAccessContext.Provider>
      )}
    </div>
  )
}
