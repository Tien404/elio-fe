import { useRef, useState } from 'react'
import { Panel, Status } from '@/components/ui'
import { ActionButton, Feedback } from '@/components/workspace/WorkspaceUI'
import { FileList, FileUploader } from './Files'
import { services } from '@/services'
import { useAction } from '@/services/use-action'
import { useAuth } from '@/services/auth-context'
import { ServiceError } from '@/services/errors'
import { formatInstant } from '@/services/presentation'
import type {
  AssignmentView,
  PreparedSubmission,
  SubmissionView,
} from '@/services/assessment-contracts'
import type { FileAsset, SubmissionReceipt } from '@/services/contracts'

type Confirmation = {
  prepared: PreparedSubmission
  outcome?: 'stale' | 'rejected'
}

function restoreConfirmation(key: string, actorId: number, assignmentId: number) {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) ?? 'null') as Confirmation | null
    return value?.prepared?.actorId === actorId && value.prepared.assignmentId === assignmentId
      ? value
      : null
  } catch {
    return null
  }
}

export function MvpSubmissionComposer({
  view,
  changed,
}: {
  view: AssignmentView
  changed(): void
}) {
  const { identity } = useAuth()
  const actorId = identity!.me.account.id
  const { id, offeringId, mode } = view.assignment
  const groupId = view.group?.id ?? null
  const version = view.submission?.version ?? 0
  const storageKey = `elio.confirmation.${actorId}.${id}`
  const [confirmation, setConfirmation] = useState(() =>
    restoreConfirmation(storageKey, actorId, id),
  )
  const [files, setFiles] = useState<FileAsset[]>([])
  const [reviewed, setReviewed] = useState<{ version: number; groupId: number | null } | null>(null)
  const [latest, setLatest] = useState<SubmissionView | null>(null)
  const [checked, setChecked] = useState(false)
  const inFlight = useRef(false)
  const action = useAction()
  const prepared = confirmation?.prepared
  const receipt = prepared?.receipt
  const latestVersion = latest?.submission?.version ?? 0
  const groupChanged = !!prepared && prepared.input.groupId !== groupId
  const needsRevisionReview = confirmation?.outcome === 'stale'

  function remember(value: Confirmation | null) {
    if (value) sessionStorage.setItem(storageKey, JSON.stringify(value))
    else sessionStorage.removeItem(storageKey)
    setConfirmation(value)
  }

  async function readLatest() {
    const stream = await services.assessment.stream(id)
    setLatest(stream)
    changed()
    return stream
  }

  async function confirm() {
    if (inFlight.current) return
    inFlight.current = true
    try {
      let request = prepared
      if (!request) {
        if (!reviewed || reviewed.groupId !== groupId) return
        request = await services.assessment.prepare(
          id,
          { expectedVersion: reviewed.version, groupId, fileIds: files.map((f) => f.id) },
          crypto.randomUUID(),
        )
        // Save the exact command before sending it. A reload can then check or replay it.
        remember({ prepared: request })
        setReviewed(null)
      }
      try {
        const result = await services.assessment.confirm(id, request)
        recordReceipt(request, result)
      } catch (error) {
        if (error instanceof ServiceError) {
          if (error.status === 412) {
            remember({ prepared: request, outcome: 'stale' })
            await readLatest().catch(() => undefined)
          } else if ([400, 404, 409, 413, 422].includes(error.status)) {
            remember({ prepared: request, outcome: 'rejected' })
          }
        }
        changed()
        throw error
      }
    } finally {
      inFlight.current = false
    }
  }

  function recordReceipt(request: PreparedSubmission, result: SubmissionReceipt) {
    remember({ prepared: { ...request, receipt: result } })
    setFiles([])
    setLatest(null)
    changed()
  }

  async function checkReceipt() {
    if (!prepared) return
    const result = await services.assessment.receipt(id, prepared.requestKey)
    if (result) {
      recordReceipt(prepared, result)
      return
    }
    setChecked(true)
    const stream = await readLatest()
    if (!groupChanged && (stream.submission?.version ?? 0) !== prepared.input.expectedVersion) {
      remember({ prepared, outcome: 'stale' })
    }
  }

  function reset(retainFiles: boolean) {
    setFiles(retainFiles ? (prepared?.files ?? files) : [])
    remember(null)
    setLatest(null)
    setReviewed(null)
    setChecked(false)
    action.clear()
  }

  return (
    <Panel title={mode === 'GROUP' ? 'Group submission' : 'Your submission'} icon="document-small">
      <Feedback action={action} />
      {view.group && <p>{view.group.name} · Any group member can submit on behalf of the team.</p>}
      {/* {view.submission?.currentVersion && (
        <p>
          Latest submission: version {view.submission.version} ·{' '}
          {view.submission.currentVersion.receiptCode}
        </p>
      )} */}
      {receipt ? (
        <>
          <Status>
            Submitted successfully
            {/* · {receipt.receiptCode} · Version {receipt.versionNo} */}
          </Status>
          {view.canSubmit && (
            <ActionButton tone="secondary" onClick={() => reset(false)}>
              Prepare another version
            </ActionButton>
          )}
        </>
      ) : prepared ? (
        <>
          <p>{prepared.files.map((f) => f.originalName).join(', ')}</p>
          {needsRevisionReview ? (
            <>
              <Status>
                The submission changed in another session. Review the latest version before
                confirming again.
              </Status>
              {latest ? (
                <>
                  {latest.submission?.currentVersion ? (
                    <>
                      <p>
                        Version {latestVersion} · {latest.submission.currentVersion.receiptCode}
                        {' · '}
                        {formatInstant(latest.submission.currentVersion.submittedAt)}
                      </p>
                      <FileList
                        files={latest.files.filter((f) =>
                          latest.submission?.currentVersion?.fileIds.includes(f.id),
                        )}
                      />
                    </>
                  ) : (
                    <p>No confirmed version is available.</p>
                  )}
                  <ActionButton
                    disabled={action.pending || !view.canSubmit || groupChanged}
                    onClick={() => {
                      reset(true)
                      setReviewed({ version: latestVersion, groupId })
                    }}
                  >
                    Continue with reviewed version
                  </ActionButton>
                </>
              ) : (
                <ActionButton
                  tone="secondary"
                  disabled={action.pending}
                  onClick={() => void action.run(readLatest)}
                >
                  Load latest submission
                </ActionButton>
              )}
              {groupChanged && (
                <ActionButton
                  tone="secondary"
                  disabled={action.pending}
                  onClick={() => reset(false)}
                >
                  Start with current group
                </ActionButton>
              )}
            </>
          ) : confirmation?.outcome === 'rejected' ? (
            <>
              <Status>
                This confirmation was rejected. Review your files before trying again.
              </Status>
              <ActionButton
                tone="secondary"
                disabled={action.pending}
                onClick={() => reset(!groupChanged)}
              >
                Edit files
              </ActionButton>
            </>
          ) : (
            <>
              <Status>
                {checked
                  ? 'No receipt was found for this confirmation. You can retry the same files.'
                  : 'A confirmation is saved on this tab. Check its receipt or retry the exact request.'}
              </Status>
              <div className="actions">
                <ActionButton
                  tone="secondary"
                  disabled={action.pending}
                  onClick={() => void action.run(checkReceipt)}
                >
                  Check receipt
                </ActionButton>
                <ActionButton disabled={action.pending} onClick={() => void action.run(confirm)}>
                  Retry confirmation
                </ActionButton>
              </div>
            </>
          )}
        </>
      ) : mode === 'GROUP' && !view.group ? (
        <Status>Ask your instructor to assign you to a group before submitting.</Status>
      ) : (
        <>
          {!view.canSubmit && (
            <Status>Submissions are closed or this course section is read-only.</Status>
          )}
          {view.canSubmit && (
            <FileUploader
              offeringId={offeringId}
              assignmentId={id}
              purpose="SUBMISSION"
              files={files}
              change={(next) => {
                setFiles(next)
                setReviewed(null)
                action.clear()
              }}
              disabled={!view.canSubmit || action.pending}
            />
          )}
          {view.canSubmit && files.length > 0 && (
            <>
              <ActionButton
                disabled={!view.canSubmit || action.pending}
                onClick={() => setReviewed({ version, groupId })}
              >
                Review files
              </ActionButton>
              {reviewed?.groupId === groupId && reviewed && (
                <>
                  <p>
                    {files.map((f) => f.originalName).join(', ')} · Next version{' '}
                    {reviewed.version + 1}
                  </p>
                  <ActionButton
                    disabled={!view.canSubmit || action.pending}
                    onClick={() => void action.run(confirm)}
                  >
                    Confirm submission
                  </ActionButton>
                </>
              )}
            </>
          )}
        </>
      )}
    </Panel>
  )
}
