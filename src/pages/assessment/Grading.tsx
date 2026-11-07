import { ActionButton as Button } from '@/components/workspace/WorkspaceUI'
import { useAssignment } from '@/services/use-assignment'
import { useCallback, useState } from 'react'
import { Panel, DataTable, Status } from '@/components/ui'
import { LoadState, Pager } from '@/components/workspace/WorkspaceUI'
import { AssignmentNav, AssignmentLoad } from '@/components/assessment/AssessmentUI'
import { GradeEditor } from '@/components/assessment/GradeEditor'
import { services } from '@/services'
import { useResource } from '@/services/use-resource'
import { useAuth } from '@/services/auth-context'
import type { GradeSubject } from '@/services/assessment-contracts'
import { WorkspaceAccessContext } from '@/services/workspace-access-context'
export function Grading() {
  const result = useAssignment(),
    view = result.data,
    id = view?.assignment.id ?? 0,
    { identity } = useAuth(),
    [page, setPage] = useState(1),
    [selected, setSelected] = useState<GradeSubject>(),
    load = useCallback(
      () => (id ? services.assessment.queue(id, { page }) : Promise.resolve(null)),
      [id, page],
    ),
    queue = useResource(load, `grade-queue:${identity!.me.account.id}:${id}:${page}`)
  return (
    <div className="course-workspace">
      <h1>{view?.assignment.mode === 'GROUP' ? 'Group grading' : 'Individual grading'}</h1>
      <AssignmentLoad result={result} />
      {view && (
        <WorkspaceAccessContext.Provider
          value={result.error ? { error: result.error, retry: result.reload } : undefined}
        >
          <div className={result.error ? 'offering-content permission-lost' : 'offering-content'}>
            <AssignmentNav view={view} />
            <Panel title="Submission queue" icon="document-small">
              <LoadState {...queue} retry={queue.reload} />
              {queue.data &&
                (queue.data.items.length ? (
                  <>
                    <DataTable
                      rows={queue.data.items}
                      rowKey={(s) => s.subjectId}
                      columns={[
                        {
                          label: view.assignment.mode === 'GROUP' ? 'Group' : 'Student',
                          render: (s) => (
                            <>
                              {s.label}
                              <small>
                                {s.recipients
                                  .map((r) => `${r.displayName} · ${r.status.toLowerCase()}`)
                                  .join(', ')}
                              </small>
                            </>
                          ),
                        },
                        {
                          label: 'Version',
                          render: (s) => s.submission?.currentVersion?.versionNo ?? '—',
                        },
                        {
                          label: 'Status',
                          render: (s) =>
                            s.grade?.publishedRevision
                              ? 'Published'
                              : s.grade?.draftRevision
                                ? 'Draft graded'
                                : s.submission?.currentVersion
                                  ? 'Awaiting grading'
                                  : 'Not submitted',
                        },
                        {
                          label: 'Actions',
                          render: (s) => (
                            <Button icon="preview" tone="secondary" onClick={() => setSelected(s)}>
                              Review / grade
                            </Button>
                          ),
                        },
                      ]}
                    />
                    <Pager value={queue.data} change={setPage} />
                  </>
                ) : (
                  <Status>
                    No eligible grade subjects. Group assignments require assigned groups.
                  </Status>
                ))}
              {!view.canGrade && (
                <Status>
                  Grade editing is available only after cutoff with current teaching access in an
                  Open section.
                </Status>
              )}
            </Panel>
            {selected && (
              <GradeEditor
                key={selected.subjectId}
                view={view}
                subject={selected}
                close={() => {
                  setSelected(undefined)
                  queue.reload()
                }}
              />
            )}
          </div>
        </WorkspaceAccessContext.Provider>
      )}
    </div>
  )
}
