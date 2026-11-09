import { ActionButton as Button } from '@/components/workspace/WorkspaceUI'
import { useState } from 'react'
import { Field, Icon, Status } from '@/components/ui'
import { Feedback } from '@/components/workspace/WorkspaceUI'
import { services } from '@/services'
import { useAction } from '@/services/use-action'
import { downloadFile, formatFileSize } from '@/services/presentation'
import type { FileAsset, FilePurpose } from '@/services/contracts'
export function FileList({ files, remove }: { files: FileAsset[]; remove?: (id: number) => void }) {
  const action = useAction()
  return (
    <>
      <Feedback action={action} />
      {files.length ? (
        <ul className="assessment-files">
          {files.map((f) => (
            <li key={f.id}>
              <span className="resource-icon">
                <Icon name="document-small" size={22} inheritColor />
              </span>
              <div>
                <strong>{f.originalName}</strong>
                <span>{formatFileSize(f.byteSize)}</span>
                <details className="file-details">
                  <summary>File details</summary>
                  <small className="hash">SHA-256: {f.sha256}</small>
                </details>
              </div>
              <div className="actions">
                <Button
                  icon="download-dark"
                  tone="secondary"
                  disabled={action.pending}
                  onClick={() => void action.run(() => downloadFile(f.id, f.originalName))}
                >
                  Download
                </Button>
                {remove && (
                  <Button danger icon="trash-white" tone="secondary" onClick={() => remove(f.id)}>
                    Remove
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p>No files attached.</p>
      )}
    </>
  )
}
export function FileUploader({
  offeringId,
  assignmentId,
  purpose,
  files,
  change,
  disabled = false,
}: {
  offeringId: number
  assignmentId?: number
  purpose: FilePurpose
  files: FileAsset[]
  change: (files: FileAsset[]) => void
  disabled?: boolean
}) {
  const [selected, setSelected] = useState<File[]>([]),
    action = useAction(),
    [progress, setProgress] = useState('')
  async function upload() {
    if (!selected.length || files.length + selected.length > 5)
      throw new Error('Select files; at most 5 files are allowed.')
    if (selected.some((f) => f.size < 1 || f.size > 20_000_000))
      throw new Error('Each file must be non-empty and no larger than 20MB.')
    const uploaded = [...files]
    for (const file of selected) {
      setProgress(`Uploading ${file.name}…`)
      const asset = await services.files.stage(file, offeringId, purpose, assignmentId)
      uploaded.push(asset)
      change([...uploaded])
    }
    setSelected([])
    setProgress('Files uploaded.')
  }
  return (
    <fieldset className="assessment-upload" disabled={disabled || action.pending}>
      <legend>
        {purpose === 'SUBMISSION' ? 'Submission files' : 'Assignment attachments'} · Up to 5 files ·
        20MB each
      </legend>
      <FileList files={files} remove={(id) => change(files.filter((f) => f.id !== id))} />
      <Field
        label="Select files"
        type="file"
        multiple
        onChange={(e) => {
          setSelected(Array.from(e.target.files ?? []))
          action.clear()
        }}
      />
      {selected.length > 0 && <p>{selected.map((f) => f.name).join(', ')}</p>}
      <Button
        tone="secondary"
        disabled={!selected.length || action.pending}
        onClick={() => void action.run(upload)}
      >
        {action.pending ? 'Uploading…' : 'Upload selected files'}
      </Button>
      <Feedback action={action} />
      {progress && <Status>{progress}</Status>}
    </fieldset>
  )
}
export function ReselectFiles({ files }: { files: FileAsset[] }) {
  const action = useAction()
  return (
    <details className="assessment-upload">
      <summary>Restore staged demo files after reload</summary>
      <p>
        Choose the same original file for each saved asset. This verifies the name, size and hash,
        retaining the confirmation key and payload.
      </p>
      {files
        .filter((f) => f.state === 'STAGING')
        .map((f) => (
          <Field
            key={f.id}
            label={`Reselect ${f.originalName}`}
            type="file"
            disabled={action.pending}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file)
                void action.run(
                  () => services.files.reselect(f.id, file),
                  undefined,
                  'Staged demo file restored.',
                )
            }}
          />
        ))}
      <Feedback action={action} />
    </details>
  )
}
