import { useOfferingRoute } from '@/services/use-offering-route'
import { MvpSubmissionReview } from '@/components/assessment/MvpSubmissionReview'
import { ActionButton as Button } from '@/components/workspace/WorkspaceUI'
import { useAssignment } from '@/services/use-assignment'
import { useCallback, useState } from 'react'
import { Link } from 'react-router'
import { DataTable, Panel, Status } from '@/components/ui'
import { Badge, ConfirmDialog, LoadState } from '@/components/workspace/WorkspaceUI'
import { AssignmentEditor } from '@/components/assessment/AssignmentEditor'
import { AssignmentNav, AssignmentLoad, Schedule } from '@/components/assessment/AssessmentUI'
import { FileList } from '@/components/assessment/Files'
import { SubmissionComposer } from '@/components/assessment/SubmissionComposer'
import { services, apiMode } from '@/services'
import { MvpSubmissionComposer } from '@/components/assessment/MvpSubmissionComposer'
import { useResource } from '@/services/use-resource'
import { useAuth } from '@/services/auth-context'
import { formatInstant } from '@/services/presentation'
import { WorkspaceAccessContext } from '@/services/workspace-access-context'
export function AssignmentDetail() {
  const { prefix } = useOfferingRoute()
  const { identity } = useAuth()
  const result = useAssignment(),
    [edit, setEdit] = useState(false),
    [archive, setArchive] = useState(false),
    [archiveVersion, setArchiveVersion] = useState(0),
    view = result.data
  return (
    <div className="course-workspace">
      <h1>Assignment details</h1>
      <AssignmentLoad result={result} />
      {view && (
        <WorkspaceAccessContext.Provider
          value={result.error ? { error: result.error, retry: result.reload } : undefined}
        >
          <div className={result.error ? 'offering-content permission-lost' : 'offering-content'}>
            <AssignmentNav view={view} />
            <Panel title={view.assignment.title} icon="book-small">
              <p className="activity-meta">
                <Badge value={view.assignment.status} /> · {view.assignment.mode.toLowerCase()} ·{' '}
                {view.assignment.maxScore} points · {view.assignment.weight}% weight ·{' '}
                {view.mandatory ? 'Required' : 'Optional'}
              </p>
              <p className="material-body">
                {view.assignment.instructions || 'No additional instructions.'}
              </p>
              <Schedule view={view} />
              <FileList files={view.attachments} />
              {view.teacher && (
                <div className="actions">
                  {view.writable && (
                    <>
                      <Button tone="secondary" onClick={() => setEdit(true)}>
                        {view.assignment.status === 'DRAFT'
                          ? 'Edit assignment'
                          : 'Extend deadlines'}
                      </Button>
                      <Button
                        danger
                        icon="archive-white"
                        tone="secondary"
                        onClick={() => {
                          setArchiveVersion(view.assignment.version)
                          setArchive(true)
                        }}
                      >
                        Archive assignment
                      </Button>
                    </>
                  )}
                  <Link
                    className="button secondary"
                    to={`${prefix}/assignments/${view.assignment.id}/grading`}
                  >
                    Open grading queue
                  </Link>
                </div>
              )}
            </Panel>
            {apiMode && view.teacher && (
              <MvpSubmissionReview
                key={view.assignment.id}
                id={view.assignment.id}
                mode={view.assignment.mode}
              />
            )}
            {!view.teacher && (
              <>
                {apiMode ? (
                  <MvpSubmissionComposer
                    key={`${identity!.me.account.id}:${view.assignment.id}`}
                    view={view}
                    changed={result.reload}
                  />
                ) : (
                  <SubmissionComposer
                    key={view.assignment.id}
                    view={view}
                    changed={result.reload}
                  />
                )}
                <SubmissionHistory
                  id={view.assignment.id}
                  streamVersion={view.submission?.version}
                  publishedGradeMaxScore={apiMode ? view.assignment.maxScore : undefined}
                />
                {view.ownGrade && (
                  <Panel title="Published grade and feedback" icon="publish-small">
                    <p>
                      {view.ownGrade.score} / {view.assignment.maxScore}
                      {view.ownGrade.isMissingZero ? ' · Published non-submission zero' : ''}
                    </p>
                    <p className="material-body">{view.ownGrade.feedback || 'No feedback.'}</p>
                  </Panel>
                )}
              </>
            )}
            {edit && (
              <AssignmentEditor
                offeringId={view.assignment.offeringId}
                view={view}
                close={() => setEdit(false)}
                saved={() => {
                  setEdit(false)
                  result.reload()
                }}
              />
            )}
            {archive && (
              <ConfirmDialog
                title="Archive assignment?"
                confirm="Archive assignment"
                close={() => setArchive(false)}
                run={() =>
                  services.assessment.save(
                    view.assignment.offeringId,
                    view.assignment.id,
                    {
                      ...view.assignment,
                      status: 'ARCHIVED',
                      topicId: view.topicId,
                      fileIds: view.attachments.map((f) => f.id),
                      mandatory: view.mandatory,
                    },
                    archiveVersion,
                  )
                }
              >
                <p>
                  Archived assignments are read-only. Existing submission and grade history is
                  preserved.
                </p>
              </ConfirmDialog>
            )}
          </div>
        </WorkspaceAccessContext.Provider>
      )}
    </div>
  )
}
export function SubmissionHistory({
  id,
  subjectId,
  streamVersion,
  submissionId,
  publishedGradeMaxScore,
}: {
  id: number
  subjectId?: number
  streamVersion?: number
  submissionId?: number
  publishedGradeMaxScore?: number
}) {
  const { identity } = useAuth(),
    load = useCallback(
      () => services.assessment.stream(id, subjectId, submissionId),
      [id, subjectId, submissionId],
    ),
    result = useResource(
      load,
      `stream:${identity!.me.account.id}:${id}:${subjectId}:${streamVersion}:${submissionId}`,
    )
  const published =
    publishedGradeMaxScore !== undefined ? result.data?.grade?.publishedRevision : null
  return (
    <>
      <LoadState {...result} retry={result.reload} />
      {result.data && (
        <>
          <Panel
            title={
              result.data.submission?.subjectType === 'GROUP'
                ? 'Frozen submission roster'
                : 'Submission members'
            }
            icon="people-small"
          >
            <p>
              {result.data.submission?.status === 'NOT_SUBMITTED'
                ? 'Not submitted · no receipt or activity completion.'
                : result.data.submission
                  ? result.data.submission.subjectType === 'GROUP'
                    ? 'These group members share every version of this submission.'
                    : 'These members share this submission.'
                  : 'Members will appear after the first submission.'}
            </p>
            {result.data.recipients.length > 0 && (
              <DataTable
                rows={result.data.recipients}
                rowKey={(r) => r.id}
                columns={[
                  { label: 'Member', render: (r) => r.displayName },
                  { label: 'Student ID', render: (r) => r.id },
                  { label: 'Account', render: (r) => <Badge value={r.status} /> },
                ]}
              />
            )}
          </Panel>
          {published && (
            <Panel title="Published grade and feedback" icon="publish-small">
              <p>
                {published.score} / {publishedGradeMaxScore} · Revision {published.revisionNo}
                {published.isMissingZero ? ' · Non-submission zero' : ''}
              </p>
              <p className="material-body">{published.feedback || 'No feedback.'}</p>
              {published.isMissingZero && published.zeroReason && <p>{published.zeroReason}</p>}
            </Panel>
          )}
          <Panel title="Version history" icon="document-small">
            {!result.data.history.length ? (
              <Status>No submissions yet.</Status>
            ) : (
              result.data.history.map((v) => (
                <details key={v.versionNo} className="version-history">
                  <summary>
                    Version {v.versionNo} · {v.isLate ? 'Late' : 'On time'} ·{' '}
                    {formatInstant(v.submittedAt)}
                  </summary>
                  <p>
                    Submitted by student {v.submittedByStudentId} · Receipt {v.receiptCode}
                  </p>
                  <FileList files={result.data!.files.filter((f) => v.fileIds.includes(f.id))} />
                </details>
              ))
            )}
          </Panel>
        </>
      )}
    </>
  )
}
