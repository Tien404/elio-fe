import { ActionButton as Button } from '@/components/workspace/WorkspaceUI'
import { useRef, useState } from 'react'
import { Field, Icon } from '@/components/ui'
import { Feedback } from '@/components/workspace/WorkspaceUI'
import { services } from '@/services'
import { useAction } from '@/services/use-action'
import { downloadFile, fileBadgeTone, fileExtension, formatFileSize } from '@/services/presentation'
import type { FileAsset, FilePurpose } from '@/services/contracts'

export function UploadCloudIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 13v8" />
      <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
      <path d="m8 17 4-4 4 4" />
    </svg>
  )
}

export function FileList({
  files,
  remove,
  showCompleted = false,
}: {
  files: FileAsset[]
  remove?: (id: number) => void
  showCompleted?: boolean
}) {
  const action = useAction()
  return (
    <>
      <Feedback action={action} />
      {files.length ? (
        <ul className="assessment-files upload-file-list">
          {files.map((f) => {
            const ext = fileExtension(f.originalName)
            return (
              <li key={f.id} className="upload-file-card">
                <span className={`upload-file-badge ${fileBadgeTone(ext)}`} aria-hidden="true">
                  {ext}
                </span>
                <div className="upload-file-info">
                  <strong className="upload-file-name">{f.originalName}</strong>
                  <div className="upload-file-meta">
                    <span>{formatFileSize(f.byteSize)}</span>
                    {showCompleted && (
                      <span className="upload-status-completed">
                        <Icon name="check" size={14} />
                        Completed
                      </span>
                    )}
                  </div>
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
                    <Button
                      danger
                      icon="trash-white"
                      tone="secondary"
                      aria-label={`Remove ${f.originalName}`}
                      onClick={() => remove(f.id)}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="upload-empty-note">No files attached.</p>
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
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [uploadingQueue, setUploadingQueue] = useState<{ name: string; size: number }[]>([])
  const action = useAction()

  async function processFiles(incoming: File[]) {
    if (!incoming.length) return
    await action.run(async () => {
      if (files.length + incoming.length > 5) {
        throw new Error('At most 5 files are allowed.')
      }
      if (incoming.some((f) => f.size < 1 || f.size > 20_000_000)) {
        throw new Error('Each file must be non-empty and no larger than 20 MB.')
      }
      setUploadingQueue(incoming.map((f) => ({ name: f.name, size: f.size })))
      const uploaded = [...files]
      try {
        for (const file of incoming) {
          const asset = await services.files.stage(file, offeringId, purpose, assignmentId)
          uploaded.push(asset)
          change([...uploaded])
          setUploadingQueue((prev) => prev.filter((item) => item.name !== file.name))
        }
      } finally {
        setUploadingQueue([])
      }
    })
  }

  const isLocked = disabled || action.pending || files.length >= 5

  return (
    <fieldset className="assessment-upload" disabled={disabled || action.pending}>
      <legend>
        {purpose === 'SUBMISSION' ? 'Submission files' : 'Assignment attachments'} · Up to 5 files ·
        20 MB each
      </legend>

      <div
        className={`upload-dropzone${dragging ? ' is-dragging' : ''}${isLocked ? ' is-disabled' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          if (!isLocked) setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          if (isLocked) return
          const dropped = Array.from(e.dataTransfer.files ?? [])
          void processFiles(dropped)
        }}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          disabled={isLocked}
          onChange={(e) => {
            const picked = Array.from(e.target.files ?? [])
            e.target.value = ''
            void processFiles(picked)
          }}
        />
        <div className="upload-dropzone-icon">
          <UploadCloudIcon />
        </div>
        <p className="upload-dropzone-title">Choose a file or drag &amp; drop it here.</p>
        <p className="upload-dropzone-hint">
          {files.length >= 5
            ? 'Maximum of 5 files reached.'
            : `Up to 5 files, 20 MB each (${5 - files.length} remaining).`}
        </p>
        <Button tone="secondary" disabled={isLocked} onClick={() => inputRef.current?.click()}>
          Browse Files
        </Button>
      </div>

      <Feedback action={action} />

      {uploadingQueue.length > 0 && (
        <ul className="assessment-files upload-file-list" aria-live="polite">
          {uploadingQueue.map((item) => {
            const ext = fileExtension(item.name)
            return (
              <li key={item.name} className="upload-file-card is-uploading">
                <span className={`upload-file-badge ${fileBadgeTone(ext)}`} aria-hidden="true">
                  {ext}
                </span>
                <div className="upload-file-info">
                  <strong className="upload-file-name">{item.name}</strong>
                  <div className="upload-file-meta">
                    <span>{formatFileSize(item.size)}</span>
                    <span className="upload-status-uploading">
                      <span className="status-dot pulse" />
                      Uploading…
                    </span>
                  </div>
                  <div className="upload-progress-track" aria-hidden="true">
                    <div className="upload-progress-fill is-indeterminate" />
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <FileList
        files={files}
        showCompleted
        remove={disabled ? undefined : (id) => change(files.filter((f) => f.id !== id))}
      />
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
