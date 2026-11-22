import { useCallback, useState } from 'react'
import { DataTable, Dialog, Field, Panel, Status } from '@/components/ui'
import {
  ActionButton as Button,
  Feedback,
  LoadState,
  TextArea,
  Select,
} from '@/components/workspace/WorkspaceUI'
import type { AssignmentView, GradeInput, GradeSubject } from '@/services/assessment-contracts'
import type { GradeRevision } from '@/services/contracts'
import { services } from '@/services'
import { mustReview, ServiceError } from '@/services/errors'
import { useAction } from '@/services/use-action'
import { useResource } from '@/services/use-resource'
import { SubmissionHistory } from '@/pages/assessment/AssignmentDetail'
import { formatInstant } from '@/services/presentation'

function privateDraft(grade: GradeSubject['grade']) {
  const draft = grade?.draftRevision
  return draft && draft.revisionNo !== grade.publishedRevision?.revisionNo ? draft : null
}

export function GradeEditor({
  view,
  subject,
  canGrade,
  refresh,
  close,
}: {
  view: AssignmentView
  subject: GradeSubject
  canGrade: boolean
  refresh(): Promise<GradeSubject>
  close(): void
}) {
  const [snapshot, setSnapshot] = useState(subject)
  const published = snapshot.grade?.publishedRevision ?? null
  const draft = privateDraft(snapshot.grade)
  const saved = draft ?? published
  const [specialMark, setSpecialMark] = useState<'ABSENT' | 'BANNED' | ''>(saved?.specialMark ?? '')
  const [score, setScore] = useState(String(saved?.score ?? ''))
  const [feedback, setFeedback] = useState(saved?.feedback ?? '')
  const [reason, setReason] = useState('')
  const [zeroReason, setZeroReason] = useState(saved?.zeroReason ?? '')
  const [confirmation, setConfirmation] = useState<'zero' | 'publish'>()
  const [showRevisions, setShowRevisions] = useState(false)
  const action = useAction()
  const { id, maxScore, mode, title } = view.assignment
  const { subjectId } = snapshot
  const submissionId = snapshot.submission?.id ?? snapshot.grade?.submissionId
  const sourceVersion = snapshot.submission?.currentVersion?.versionNo ?? null
  const missing = sourceVersion === null
  const dirty =
    specialMark !== (saved?.specialMark ?? '') ||
    score !== String(saved?.score ?? '') ||
    feedback !== (saved?.feedback ?? '') ||
    reason !== '' ||
    zeroReason !== (saved?.zeroReason ?? '')
  const needsReview =
    mustReview(action.error) ||
    (action.error instanceof ServiceError &&
      [
        'GRADE_EXISTS',
        'ALREADY_SUBMITTED',
        'INVALID_SOURCE_VERSION',
        'DRAFT_REVISION_REQUIRED',
        'GRADING_NOT_OPEN',
        'CLASS_READ_ONLY',
        'ASSIGNMENT_READ_ONLY',
      ].includes(action.error.fields.code))
  const locked = !canGrade || action.pending || needsReview
  const validScore =
    /^(?:\d+(?:\.\d{0,2})?|\.\d{1,2})$/.test(score.trim()) && Number(score) <= maxScore
  const canSave =
    !locked &&
    snapshot.recipients.length > 0 &&
    (missing ? !!zeroReason.trim() : !!specialMark || validScore) &&
    (!published || !!reason.trim()) &&
    (!saved || dirty)
  const loadRevisions = useCallback(
    async () =>
      showRevisions && submissionId
        ? (await services.assessment.stream(id, subjectId, submissionId)).revisions
        : null,
    [id, subjectId, showRevisions, submissionId],
  )
  const revisions = useResource(
    loadRevisions,
    `grade-revisions:${id}:${subjectId}:${snapshot.grade?.version}:${showRevisions}`,
  )

  function adopt(next: GradeSubject) {
    const revision = privateDraft(next.grade) ?? next.grade?.publishedRevision
    setSnapshot(next)
    setScore(String(revision?.score ?? ''))
    setSpecialMark(revision?.specialMark ?? '')
    setFeedback(revision?.feedback ?? '')
    setZeroReason(revision?.zeroReason ?? '')
    setReason('')
  }
  async function reload() {
    setConfirmation(undefined)
    adopt(await refresh())
  }
  async function save() {
    const input: GradeInput = {
      subjectId,
      submissionId: submissionId ?? null,
      gradeRecordId: snapshot.grade?.id ?? null,
      expectedSubmissionVersion: snapshot.submission?.version ?? 0,
      expectedGradeVersion: snapshot.grade?.version ?? 0,
      sourceVersionNo: sourceVersion,
      score: missing || specialMark ? 0 : Number(score),
      specialMark: specialMark || null,
      feedback: feedback.trim() || null,
      reason: reason.trim() || null,
      zeroReason: missing ? zeroReason.trim() : null,
    }
    const grade = await services.assessment.saveGrade(id, input)
    adopt({ ...snapshot, grade })
    setConfirmation(undefined)
  }
  async function publish() {
    if (!snapshot.grade || !draft) return
    const grade = await services.assessment.publishGrade(
      id,
      snapshot.grade.id,
      draft.revisionNo,
      snapshot.grade.version,
    )
    adopt({ ...snapshot, grade })
    setConfirmation(undefined)
  }

  return (
    <Dialog
      wide
      title={`${mode === 'GROUP' ? 'Group' : 'Individual'} grading · ${snapshot.label}`}
      close={close}
    >
      {!confirmation && <Feedback action={action} review={() => void action.run(reload)} />}
      <Panel title={title} icon="info">
        <p>{missing ? 'Not submitted' : `Submission version ${sourceVersion}`}</p>
        <p>
          {mode === 'GROUP' && submissionId ? 'Frozen recipients' : 'Recipients'}:{' '}
          {snapshot.recipients
            .map((r) => `${r.displayName} (${r.status.toLowerCase()})`)
            .join(', ')}
        </p>
        {!canGrade && (
          <Status>Grade editing is unavailable until after cutoff with teaching access.</Status>
        )}
        {published && (
          <RevisionSummary title="Currently published" revision={published} maxScore={maxScore} />
        )}
        {draft && (
          <RevisionSummary title="Saved private draft" revision={draft} maxScore={maxScore} />
        )}
        {canGrade && (
          <fieldset disabled={locked}>
            <Select
              label="Grade type"
              value={specialMark}
              onChange={(e) => setSpecialMark(e.target.value as typeof specialMark)}
              disabled={locked}
            >
              <option value="">Numeric score (0 for all incorrect)</option>
              {missing && <option value="ABSENT">11 · Absent (counts as 0)</option>}
              <option value="BANNED">12 · Banned (counts as 0)</option>
            </Select>
            <Field
              label={`Grade / ${maxScore}`}
              type="number"
              min={0}
              max={maxScore}
              step="0.01"
              value={missing ? '0' : score}
              disabled={missing || !!specialMark}
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
            )}
            {published && (
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
                disabled={!canSave}
                onClick={() =>
                  missing && !snapshot.grade ? setConfirmation('zero') : void action.run(save)
                }
              >
                {missing && !snapshot.grade ? 'Record non-submission zero…' : 'Save private draft'}
              </Button>
              {draft && (
                <Button disabled={dirty} onClick={() => setConfirmation('publish')}>
                  {published ? 'Republish saved grade' : 'Publish saved grade'}
                </Button>
              )}
            </div>
            {dirty && draft && <p>Save the current draft before publication.</p>}
          </fieldset>
        )}
      </Panel>
      {submissionId && (
        <SubmissionHistory id={id} subjectId={subjectId} submissionId={submissionId} />
      )}
      <div className="actions">
        {snapshot.grade && (
          <Button
            icon="document-small"
            tone="secondary"
            onClick={() => setShowRevisions(!showRevisions)}
          >
            {showRevisions ? 'Hide grade revision history' : 'View grade revision history'}
          </Button>
        )}
        <Button icon="cancel-dark" tone="secondary" onClick={close}>
          Close grading
        </Button>
      </div>
      {showRevisions && (
        <Panel title="Grade revision history" icon="book-small">
          <LoadState {...revisions} retry={revisions.reload} />
          {revisions.data &&
            (revisions.data.length ? (
              <DataTable
                rows={revisions.data}
                rowKey={(r) => r.revisionNo}
                columns={[
                  { label: 'Revision', render: (r) => r.revisionNo },
                  {
                    label: 'Source',
                    render: (r) =>
                      r.sourceVersionNo === null ? 'Not submitted' : `Version ${r.sourceVersionNo}`,
                  },
                  { label: 'Score', render: (r) => r.score },
                  { label: 'Feedback', render: (r) => r.feedback || '—' },
                  {
                    label: 'Reason',
                    render: (r) => [r.zeroReason, r.reason].filter(Boolean).join(' · ') || '—',
                  },
                  {
                    label: 'Saved',
                    render: (r) => `${formatInstant(r.createdAt)} · Instructor ${r.revisedBy}`,
                  },
                ]}
              />
            ) : (
              <Status>No saved revisions.</Status>
            ))}
        </Panel>
      )}
      {confirmation && (
        <Dialog
          title={confirmation === 'zero' ? 'Zero for non-submission' : 'Publish saved grade?'}
          close={() => setConfirmation(undefined)}
        >
          <Feedback action={action} review={() => void action.run(reload)} />
          {confirmation === 'zero' ? (
            <p>
              Save score 0 as a private draft.{' '}
              {mode === 'GROUP' && 'The assigned group roster will be frozen.'}
            </p>
          ) : (
            <p>
              Publish revision {draft?.revisionNo}: {draft?.score} / {maxScore} to its recipients.
            </p>
          )}
          <div className="actions">
            <Button
              tone="secondary"
              disabled={action.pending}
              onClick={() => setConfirmation(undefined)}
            >
              Cancel
            </Button>
            <Button
              disabled={confirmation === 'zero' ? !canSave : locked || dirty || !draft}
              onClick={() => void action.run(confirmation === 'zero' ? save : publish)}
            >
              {confirmation === 'zero' ? 'Save reasoned zero' : 'Publish grade revision'}
            </Button>
          </div>
        </Dialog>
      )}
    </Dialog>
  )
}

function RevisionSummary({
  title,
  revision,
  maxScore,
}: {
  title: string
  revision: GradeRevision
  maxScore: number
}) {
  return (
    <section>
      <h3>{title}</h3>
      <p>
        {revision.specialMark
          ? revision.specialMark === 'ABSENT'
            ? '11 · Absent'
            : '12 · Banned'
          : `${revision.score} / ${maxScore}`}{' '}
        · Revision {revision.revisionNo}
      </p>
      <p>{revision.feedback || 'No feedback.'}</p>
      {revision.zeroReason && <p>Non-submission reason: {revision.zeroReason}</p>}
      {revision.reason && <p>Private correction reason: {revision.reason}</p>}
    </section>
  )
}
