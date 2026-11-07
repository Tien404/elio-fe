import { ActionButton as Button } from '@/components/workspace/WorkspaceUI'
import { useState } from 'react'
import { Dialog, Field, Panel, Status, DataTable } from '@/components/ui'
import { Feedback, TextArea, ConfirmDialog } from '@/components/workspace/WorkspaceUI'
import type { AssignmentView, GradeInput, GradeSubject } from '@/services/assessment-contracts'
import { services } from '@/services'
import { useAction } from '@/services/use-action'
import { SubmissionHistory } from '@/pages/assessment/AssignmentDetail'
import { formatInstant } from '@/services/presentation'
export function GradeEditor({
  view,
  subject,
  close,
}: {
  view: AssignmentView
  subject: GradeSubject
  close(): void
}) {
  const [snapshot, setSnapshot] = useState(subject),
    r = snapshot.grade?.draftRevision,
    [score, setScore] = useState(String(r?.score ?? '')),
    [feedback, setFeedback] = useState(r?.feedback ?? ''),
    [reason, setReason] = useState(''),
    [zeroReason, setZeroReason] = useState(r?.zeroReason ?? ''),
    [zero, setZero] = useState(false),
    [publish, setPublish] = useState(false),
    [revisions, setRevisions] = useState(false),
    [revisionRows, setRevisionRows] = useState<import('@/services/contracts').GradeRevision[]>([]),
    action = useAction(),
    missing = !snapshot.submission?.currentVersion
  const dirty =
    score !== String(r?.score ?? '') ||
    feedback !== (r?.feedback ?? '') ||
    reason !== '' ||
    zeroReason !== (r?.zeroReason ?? '')
  async function save() {
    const input: GradeInput = {
      subjectId: snapshot.subjectId,
      expectedSubmissionVersion: snapshot.submission?.version ?? 0,
      expectedGradeVersion: snapshot.grade?.version ?? 0,
      sourceVersionNo: snapshot.submission?.currentVersion?.versionNo ?? null,
      score: missing ? 0 : Number(score),
      feedback,
      reason: reason || null,
      zeroReason: missing ? zeroReason : null,
    }
    if (!missing && score.trim() === '') throw new Error('Enter a score.')
    await services.assessment.saveGrade(view.assignment.id, input)
    await reload()
    setZero(false)
  }
  async function reload() {
    const stream = await services.assessment.stream(view.assignment.id, snapshot.subjectId)
    setSnapshot((v) => ({ ...v, submission: stream.submission, grade: stream.grade }))
    setScore(String(stream.grade?.draftRevision?.score ?? ''))
    setFeedback(stream.grade?.draftRevision?.feedback ?? '')
    setZeroReason(stream.grade?.draftRevision?.zeroReason ?? '')
    setReason('')
  }
  return (
    <Dialog
      wide
      title={`${view.assignment.mode === 'GROUP' ? 'Group' : 'Individual'} grading · ${snapshot.label}`}
      close={close}
    >
      <Feedback action={action} review={() => void action.run(reload)} />
      <Panel title={view.assignment.title} icon="info">
        <p>
          Effective submission version: {snapshot.submission?.currentVersion?.versionNo ?? 'None'} ·
          Grade version: {snapshot.grade?.version ?? 0}
        </p>
        <p>
          Recipients:{' '}
          {snapshot.recipients
            .map((r) => `${r.displayName} (${r.status.toLowerCase()})`)
            .join(', ')}
        </p>
        {!view.canGrade && (
          <Status>
            Grading is available strictly after cutoff, in an Open course section, with current
            teaching access.
          </Status>
        )}
        {snapshot.grade?.publishedRevision && (
          <Status>
            Students currently see {snapshot.grade.publishedRevision.score} /{' '}
            {view.assignment.maxScore} from revision {snapshot.grade.publishedRevision.revisionNo}.
            Private draft changes remain hidden until republished.
          </Status>
        )}
        <fieldset disabled={!view.canGrade || action.pending}>
          <Field
            label={`Grade / ${view.assignment.maxScore}`}
            type="number"
            min={0}
            max={view.assignment.maxScore}
            step="0.01"
            value={missing ? '0' : score}
            disabled={missing}
            onChange={(e) => setScore(e.target.value)}
          />
          <TextArea
            label="Feedback"
            maxLength={10000}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
          />
          {missing && (
            <TextArea
              label="Reason for non-submission zero (required)"
              maxLength={1000}
              value={zeroReason}
              onChange={(e) => setZeroReason(e.target.value)}
            />
          )}{' '}
          {snapshot.grade?.publishedRevision && (
            <TextArea
              label="Private correction reason (required)"
              maxLength={1000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          )}
          <div className="actions">
            <Button
              tone="secondary"
              onClick={() => (missing ? setZero(true) : void action.run(save))}
            >
              {missing ? 'Record reasoned missing-zero…' : 'Save private draft'}
            </Button>
            <Button
              disabled={!snapshot.grade?.draftRevision || dirty}
              onClick={() => setPublish(true)}
            >
              {snapshot.grade?.publishedRevision ? 'Republish saved grade' : 'Publish saved grade'}
            </Button>
          </div>
          {dirty && snapshot.grade?.draftRevision && (
            <p>Save the current draft before publication.</p>
          )}
        </fieldset>
      </Panel>
      <SubmissionHistory id={view.assignment.id} subjectId={snapshot.subjectId} />
      <div className="actions">
        <Button
          icon="document-small"
          tone="secondary"
          disabled={action.pending}
          onClick={() =>
            void action.run(
              () => services.assessment.stream(view.assignment.id, snapshot.subjectId),
              (v) => {
                setRevisionRows(v.revisions)
                setRevisions(true)
              },
            )
          }
        >
          View immutable grade revisions
        </Button>
        <Button icon="cancel-dark" tone="secondary" onClick={close}>
          Close grading
        </Button>
      </div>
      {revisions && (
        <Panel title="Grade revision history" icon="book-small">
          {revisionRows.length ? (
            <DataTable
              rows={revisionRows}
              rowKey={(r) => r.revisionNo}
              columns={[
                { label: 'Revision', render: (r) => r.revisionNo },
                { label: 'Source', render: (r) => r.sourceVersionNo ?? 'NOT_SUBMITTED' },
                { label: 'Score', render: (r) => r.score },
                {
                  label: 'Feedback / reason',
                  render: (r) => (
                    <>
                      {r.feedback}
                      <small>{r.reason || r.zeroReason}</small>
                    </>
                  ),
                },
                {
                  label: 'Saved',
                  render: (r) => `${formatInstant(r.createdAt)} · Instructor ${r.revisedBy}`,
                },
              ]}
            />
          ) : (
            <Status>No saved revisions.</Status>
          )}
        </Panel>
      )}
      {zero && (
        <Dialog title="Zero for non-submission" close={() => setZero(false)}>
          <Feedback action={action} />
          <p>
            This records NOT_SUBMITTED with score 0 and the reason provided. It creates no version,
            file, receipt or completion. A group freezes its assigned recipients, including locked
            accounts.
          </p>
          <div className="actions">
            <Button icon="cancel-dark" tone="secondary" onClick={() => setZero(false)}>
              Cancel
            </Button>
            <Button
              icon="complete-white"
              disabled={action.pending}
              onClick={() => void action.run(save)}
            >
              Save reasoned zero
            </Button>
          </div>
        </Dialog>
      )}
      {publish && snapshot.grade?.draftRevision && (
        <ConfirmDialog
          title="Publish saved grade?"
          confirm="Publish grade revision"
          close={() => setPublish(false)}
          run={async () => {
            await services.assessment.publishGrade(
              view.assignment.id,
              snapshot.grade!.id,
              snapshot.grade!.draftRevision!.revisionNo,
              snapshot.grade!.version,
            )
            await reload()
          }}
        >
          <p>
            Publish revision {snapshot.grade.draftRevision.revisionNo}:{' '}
            {snapshot.grade.draftRevision.score} / {view.assignment.maxScore} to all finalized
            recipients.
          </p>
        </ConfirmDialog>
      )}
    </Dialog>
  )
}
