import { ActionButton as Button } from '@/components/workspace/WorkspaceUI'
import { useState } from 'react'
import { Dialog, Panel, Status, Icon } from '@/components/ui'
import { Feedback } from '@/components/workspace/WorkspaceUI'
import { FileUploader, ReselectFiles } from './Files'
import { services } from '@/services'
import { useAction } from '@/services/use-action'
import { useAuth } from '@/services/auth-context'
import { formatInstant, formatFileSize } from '@/services/presentation'
import type { AssignmentView, PreparedSubmission } from '@/services/assessment-contracts'
import type { FileAsset } from '@/services/contracts'
function readContext(key: string) {
  try {
    return JSON.parse(sessionStorage.getItem(key) ?? 'null') as PreparedSubmission | null
  } catch {
    return null
  }
}
export function SubmissionComposer({ view, changed }: { view: AssignmentView; changed(): void }) {
  const { identity } = useAuth(),
    actor = identity!.me.account.id,
    a = view.assignment,
    storageKey = `elio.review.${actor}.${a.id}`
  const [prepared, setPrepared] = useState<PreparedSubmission | null>(() =>
      readContext(storageKey),
    ),
    [files, setFiles] = useState<FileAsset[]>(() => readContext(storageKey)?.files ?? []),
    [review, setReview] = useState(false),
    [reviewedVersion, setReviewedVersion] = useState(view.submission?.version ?? 0),
    action = useAction(),
    [checked, setChecked] = useState(false),
    [reset, setReset] = useState(false)
  function remember(value: PreparedSubmission) {
    sessionStorage.setItem(storageKey, JSON.stringify(value))
    setPrepared(value)
  }
  async function prepare() {
    const value = await services.assessment.prepare(
      a.id,
      {
        expectedVersion: reviewedVersion,
        groupId: view.group?.id ?? null,
        fileIds: files.map((f) => f.id),
      },
      crypto.randomUUID(),
    )
    remember(value)
    setChecked(false)
    setReview(true)
  }
  async function confirm() {
    if (!prepared) throw new Error('Review the uploaded files first.')
    const receipt = await services.assessment.confirm(a.id, prepared)
    remember({ ...prepared, receipt })
    setReview(false)
    changed()
  }
  async function check() {
    if (!prepared) return
    const receipt = await services.assessment.receipt(a.id, prepared.requestKey)
    setChecked(true)
    if (receipt) {
      remember({ ...prepared, receipt })
      changed()
    }
  }
  function clear() {
    sessionStorage.removeItem(storageKey)
    setPrepared(null)
    setFiles([])
    setReviewedVersion(view.submission?.version ?? 0)
    setChecked(false)
    setReset(false)
    action.clear()
  }
  if (a.mode === 'GROUP' && !view.group)
    return (
      <Panel title="Group not assigned" icon="info">
        <p>
          Ask your instructor to assign you to a group. Any group member can submit on behalf of the
          team.
        </p>
      </Panel>
    )
  return (
    <Panel
      title={
        prepared?.receipt
          ? 'Submission receipt'
          : view.submission?.currentVersion
            ? 'Resubmit assignment'
            : 'Your submission'
      }
      icon="info"
    >
      <ol className="submission-steps" aria-label="Submission steps">
        {['Add files', 'Review', 'Submit'].map((step, index) => {
          const current = prepared?.receipt ? 3 : prepared ? 1 : 0
          return (
            <li
              key={step}
              className={index < current ? 'is-complete' : index === current ? 'is-current' : ''}
              aria-current={index === current ? 'step' : undefined}
            >
              <span>
                {index < current ? <Icon name="check" size={16} inheritColor /> : index + 1}
              </span>
              {step}
            </li>
          )
        })}
      </ol>
      <Feedback action={action} />
      {prepared ? (
        <>
          {prepared.receipt && (
            <dl className="assessment-receipt">
              <dt>Receipt</dt>
              <dd>
                {prepared.receipt.receiptCode} · Version {prepared.receipt.versionNo}
                <br />
                {formatInstant(prepared.receipt.submittedAt)}
              </dd>
            </dl>
          )}
          <details className="submission-details">
            <summary>Submission details</summary>
            <dl className="assessment-receipt">
              <dt>Request key</dt>
              <dd>{prepared.requestKey}</dd>
              <dt>Payload SHA-256</dt>
              <dd>{prepared.payloadHash}</dd>
              <dt>Expected version</dt>
              <dd>{prepared.input.expectedVersion}</dd>
            </dl>
          </details>
          <p>
            {prepared.files
              .map((f) => `${f.originalName} (${formatFileSize(f.byteSize)})`)
              .join(', ')}
          </p>
          {checked && !prepared.receipt && (
            <Status>
              No submission receipt was found. Retry these files, or check the latest submission
              before starting again.
            </Status>
          )}
          <div className="actions">
            <Button
              icon="preview"
              tone="secondary"
              disabled={action.pending}
              onClick={() => void action.run(check)}
            >
              Check receipt
            </Button>
            {!prepared.receipt && (
              <Button icon="preview" disabled={action.pending} onClick={() => setReview(true)}>
                Review and submit
              </Button>
            )}
            <Button
              tone="secondary"
              disabled={
                action.pending ||
                (!!prepared.receipt && !view.canSubmit) ||
                (!prepared.receipt && !checked)
              }
              onClick={() => setReset(true)}
            >
              {prepared.receipt ? 'Prepare another version' : 'Start a new submission'}
            </Button>
          </div>
          {!prepared.receipt && <ReselectFiles files={prepared.files} />}
        </>
      ) : (
        <>
          {view.canSubmit && view.submission?.currentVersion && (
            <Button
              tone="secondary"
              disabled={!view.canSubmit || action.pending}
              onClick={() =>
                void action.run(
                  () => services.assessment.stream(a.id),
                  (stream) =>
                    setFiles(
                      stream.files.filter((f) =>
                        stream.submission?.currentVersion?.fileIds.includes(f.id),
                      ),
                    ),
                )
              }
            >
              Reuse latest confirmed files
            </Button>
          )}
          {view.canSubmit && (
            <FileUploader
              offeringId={a.offeringId}
              purpose="SUBMISSION"
              files={files}
              change={setFiles}
              disabled={!view.canSubmit || action.pending}
            />
          )}
          {!view.canSubmit && (
            <Status>
              New confirmations are unavailable outside the submission window, in Archived sections
              or after a saved grade/zero. Existing receipts remain available.
            </Status>
          )}
          {reviewedVersion !== (view.submission?.version ?? 0) && (
            <Button
              tone="secondary"
              onClick={() => {
                setFiles([])
                setReviewedVersion(view.submission?.version ?? 0)
              }}
            >
              Discard files and load latest submission
            </Button>
          )}
          {view.canSubmit && (
            <Button
              icon="preview"
              disabled={!view.canSubmit || !files.length || action.pending}
              onClick={() => void action.run(prepare)}
            >
              Review submission
            </Button>
          )}
        </>
      )}
      {review && prepared && (
        <Dialog title="Review and confirm submission" close={() => setReview(false)}>
          <Feedback action={action} />
          <p>
            {a.title} · {view.group?.name ?? 'Individual submission'}
          </p>
          <p>{prepared.files.map((f) => f.originalName).join(', ')}</p>
          <p>Review the selected files, then confirm to submit your assignment.</p>
          {view.group && (
            <Status>
              This submission and its grade are shared with all assigned group members.
            </Status>
          )}
          <div className="actions">
            <Button tone="secondary" disabled={action.pending} onClick={() => setReview(false)}>
              Back to review
            </Button>
            <Button
              icon="complete-white"
              disabled={action.pending}
              onClick={() => void action.run(confirm)}
            >
              Confirm submission
            </Button>
          </div>
        </Dialog>
      )}
      {reset && (
        <Dialog title="Start a different submission?" close={() => setReset(false)}>
          <p>
            {prepared?.receipt
              ? 'The previous receipt and version remain in history.'
              : 'No receipt was found. Review the current saved version before replacing this prepared request. A delayed successful request can still cause a stale conflict.'}
          </p>
          <p>
            This discards the prepared file selection and key from this tab only. Upload and review
            a new payload explicitly.
          </p>
          <div className="actions">
            <Button icon="cancel-dark" tone="secondary" onClick={() => setReset(false)}>
              Cancel
            </Button>
            <Button onClick={clear}>Review current version and start new selection</Button>
          </div>
        </Dialog>
      )}
    </Panel>
  )
}
