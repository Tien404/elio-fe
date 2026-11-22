import { useAction } from '@/services/use-action'
import { Feedback } from '@/components/workspace/WorkspaceUI'
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
  const action = useAction()
  const assignment = useAssignment(),
    view = assignment.data,
    { identity } = useAuth(),
    id = view?.assignment.mode === 'GROUP' ? view.assignment.id : 0,
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
            {!id ? (
              <Status>This is an individual assignment.</Status>
            ) : (
              <Panel title="Groups for assignment" icon="people-small">
                <p>
                  {view.offeringLabel} · {view.assignment.title}
                </p>
                <Feedback action={action} />
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
                            label: 'Roster',
                            render: (g) =>
                              g.group.lockedAt ? (
                                <>
                                  Frozen · {formatInstant(g.group.lockedAt)}
                                  <small>{g.members.map((r) => r.displayName).join(', ')}</small>
                                </>
                              ) : (
                                'Not frozen'
                              ),
                          },
                          {
                            label: 'Actions',
                            render: (g) =>
                              view.teacher && view.writable && !g.group.lockedAt ? (
                                <Button tone="secondary" onClick={() => setEditor(g)}>
                                  Edit group
                                </Button>
                              ) : g.group.lockedAt ? (
                                'Members fixed'
                              ) : !view.teacher && view.assignment.groupFormation === 'SELF' ? (
                                <Button
                                  tone="secondary"
                                  disabled={action.pending}
                                  onClick={() =>
                                    void action.run(
                                      () =>
                                        g.group.memberStudentIds.includes(identity!.me.account.id)
                                          ? services.assessment.leaveGroup(g.group.id)
                                          : services.assessment.joinGroup(g.group.id),
                                      () => {
                                        result.reload()
                                        assignment.reload()
                                      },
                                    )
                                  }
                                >
                                  {g.group.memberStudentIds.includes(identity!.me.account.id)
                                    ? 'Leave group'
                                    : 'Join group'}
                                </Button>
                              ) : (
                                'Read-only'
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
                {(view.teacher
                  ? view.writable
                  : view.assignment.groupFormation === 'SELF' && !view.group) &&
                  !result.loading && (
                    <Button icon="add" tone="secondary" onClick={() => setEditor(null)}>
                      Create group
                    </Button>
                  )}
              </Panel>
            )}
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
