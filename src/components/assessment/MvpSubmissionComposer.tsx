import { useState } from 'react'
import { Panel, Status } from '@/components/ui'
import { ActionButton, Feedback } from '@/components/workspace/WorkspaceUI'
import { FileUploader } from './Files'
import { services } from '@/services'
import { useAction } from '@/services/use-action'
import type { AssignmentView } from '@/services/assessment-contracts'
import type { FileAsset, SubmissionReceipt } from '@/services/contracts'
export function MvpSubmissionComposer({
  view,
  changed,
}: {
  view: AssignmentView
  changed(): void
}) {
  const [files, setFiles] = useState<FileAsset[]>([]),
    [review, setReview] = useState(false),
    [receipt, setReceipt] = useState<SubmissionReceipt | null>(null),
    [uncertain, setUncertain] = useState(false)
  const action = useAction()
  const id = view.assignment.id
  async function submit() {
    try {
      const prepared = await services.assessment.prepare(
        id,
        {
          expectedVersion: view.submission?.version ?? 0,
          fileIds: files.map((f) => f.id),
          groupId: null,
        },
        crypto.randomUUID(),
      )
      const result = await services.assessment.confirm(id, prepared)
      setReceipt(result)
      setFiles([])
      setReview(false)
      changed()
    } catch (error) {
      // A mutation may have committed even when its response is unavailable.
      setUncertain(true)
      changed()
      throw error
    }
  }
  return (
    <Panel title="Your submission" icon="document-small">
      <Feedback action={action} />
      {view.submission?.currentVersion && (
        <p>
          Latest submission: version {view.submission.version} ·{' '}
          {view.submission.currentVersion.receiptCode}
        </p>
      )}
      {receipt && (
        <Status>
          Submitted successfully · {receipt.receiptCode} · Version {receipt.versionNo}
        </Status>
      )}
      {uncertain ? (
        <>
          <Status>
            Reload the latest submission and inspect its version before starting another upload.
            Automatic retry and receipt lookup are not supported in MVP.
          </Status>
          <ActionButton tone="secondary" onClick={() => window.location.reload()}>
            Reload submission
          </ActionButton>
        </>
      ) : (
        <>
          {!view.canSubmit && (
            <Status>Submissions are closed or this course section is read-only.</Status>
          )}
          <FileUploader
            offeringId={view.assignment.offeringId}
            assignmentId={id}
            purpose="SUBMISSION"
            files={files}
            change={(f) => {
              setFiles(f)
              setReview(false)
            }}
            disabled={!view.canSubmit || action.pending}
          />
          {files.length > 0 && (
            <>
              <ActionButton
                disabled={!view.canSubmit || action.pending}
                onClick={() => setReview(true)}
              >
                Review files
              </ActionButton>
              {review && (
                <>
                  <p>
                    {files.map((f) => f.originalName).join(', ')} · Next version{' '}
                    {(view.submission?.version ?? 0) + 1}
                  </p>
                  <ActionButton
                    disabled={!view.canSubmit || action.pending}
                    onClick={() => void action.run(submit)}
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
