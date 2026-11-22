import { useAction } from '@/services/use-action'
import { Feedback } from '@/components/workspace/WorkspaceUI'
import { ActionButton as Button } from '@/components/workspace/WorkspaceUI'
import { useAssignment } from '@/services/use-assignment'
import { useCallback, useEffect, useState } from 'react'
import { Panel, DataTable, Status } from '@/components/ui'
import { LoadState, Pager } from '@/components/workspace/WorkspaceUI'
import { AssignmentNav, AssignmentLoad } from '@/components/assessment/AssessmentUI'
import { GradeEditor } from '@/components/assessment/GradeEditor'
import { services } from '@/services'
import { useResource } from '@/services/use-resource'
import { useAuth } from '@/services/auth-context'
import type { GradeSubject } from '@/services/assessment-contracts'
import { ServiceError } from '@/services/errors'
import { WorkspaceAccessContext } from '@/services/workspace-access-context'
export function Grading() {
  const publication = useAction()
  const result = useAssignment(),
    view = result.data,
    id = view?.teacher ? view.assignment.id : 0,
    { identity } = useAuth(),
    [page, setPage] = useState(1),
    [selected, setSelected] = useState<GradeSubject>(),
    load = useCallback(
      () => (id ? services.assessment.queue(id, { page }) : Promise.resolve(null)),
      [id, page],
    ),
    queue = useResource(load, `grade-queue:${identity!.me.account.id}:${id}:${page}`)
  const refreshQueue = queue.reload
  useEffect(() => {
    if (!id) return
    const timer = window.setInterval(refreshQueue, 30_000)
    return () => window.clearInterval(timer)
  }, [id, refreshQueue])
  async function refreshSubject(subjectId: number) {
    const fresh = await services.assessment.queue(id, { page })
    refreshQueue()
    const subject = fresh.items.find((row) => row.subjectId === subjectId)
    if (!subject)
      throw new ServiceError(
        404,
        'This subject is no longer on this queue page. Reopen it from the queue.',
      )
    return subject
  }
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
            {!view.teacher ? (
              <Status error>Teaching access is required to view the grading queue.</Status>
            ) : (
              <Panel title="Submission queue" icon="document-small">
                <Feedback action={publication} />
                {queue.data?.canGrade && (
                  <Button
                    tone="secondary"
                    disabled={publication.pending}
                    onClick={() => {
                      if (window.confirm('Publish every saved draft for this assignment?'))
                        void publication.run(
                          () => services.assessment.releaseGrades(id),
                          () => queue.reload(),
                        )
                    }}
                  >
                    Publish all saved drafts
                  </Button>
                )}
                <LoadState {...queue} retry={queue.reload} />
                {queue.data &&
                  (queue.data.items.length ? (
                    <>
                      <DataTable
                        rows={queue.data.items}
                        rowKey={(s) => s.subjectId}
                        columns={[
                          {
                            label: queue.data.subjectType === 'GROUP' ? 'Group' : 'Student',
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
                            label: 'Submission',
                            render: (s) =>
                              s.submission?.currentVersion
                                ? `Version ${s.submission.currentVersion.versionNo}`
                                : 'Not submitted',
                          },
                          {
                            label: 'Grade status',
                            render: (s) => {
                              const published = s.grade?.publishedRevision
                              const draft = s.grade?.draftRevision
                              if (published && draft && published.revisionNo !== draft.revisionNo)
                                return 'Published · Correction draft'
                              if (published) return 'Published'
                              if (draft) return 'Private draft'
                              return 'Ungraded'
                            },
                          },
                          {
                            label: 'Actions',
                            render: (s) => (
                              <Button
                                icon="preview"
                                tone="secondary"
                                disabled={queue.loading}
                                onClick={() => setSelected(s)}
                              >
                                {queue.data?.canGrade ? 'Review / grade' : 'Review'}
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
                {queue.data && !queue.data.canGrade && (
                  <Status>
                    Grade editing requires a published assignment, a section that allows changes,
                    and a cutoff that has passed.
                  </Status>
                )}
              </Panel>
            )}
            {selected && view.teacher && (
              <GradeEditor
                key={`${id}:${selected.subjectId}`}
                view={view}
                subject={selected}
                canGrade={!!queue.data?.canGrade && !queue.error && !result.error}
                refresh={() => refreshSubject(selected.subjectId)}
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
