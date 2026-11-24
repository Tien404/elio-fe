import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { Button, Dialog, Field, Icon } from '@/components/ui'
import {
  ActionButton,
  Feedback,
  LoadState,
  Pager,
  Select,
  TextArea,
} from '@/components/workspace/WorkspaceUI'
import { UploadCloudIcon } from '@/components/assessment/Files'
import { fileBadgeTone, fileExtension, formatFileSize } from '@/services/presentation'
import type { MaterialView } from '@/services/course-contracts'
import type { FileAsset, Resource } from '@/services/contracts'
import { apiMode, services } from '@/services'
import { useAction } from '@/services/use-action'
import { useResource } from '@/services/use-resource'

export function MaterialEditor({
  offeringId,
  saved,
  close,
}: {
  offeringId: number
  saved?: MaterialView
  close(): void
}) {
  const [title, setTitle] = useState(saved?.resource.title ?? ''),
    [kind, setKind] = useState<Resource['kind']>(saved?.resource.kind ?? 'TEXT'),
    [topicId, setTopicId] = useState(saved?.resource.topicId ? String(saved.resource.topicId) : ''),
    [body, setBody] = useState(saved?.resource.body ?? ''),
    [url, setUrl] = useState(saved?.resource.externalUrl ?? ''),
    [mandatory, setMandatory] = useState(saved?.mandatory ?? true),
    [file, setFile] = useState<File | null>(null),
    [asset, setAsset] = useState<FileAsset | null>(saved?.files[0] ?? null),
    [expected, setExpected] = useState(saved?.resource.version),
    [preview, setPreview] = useState(false),
    [page, setPage] = useState(1),
    [search, setSearch] = useState('')
  const action = useAction(),
    upload = useAction(),
    fileInputRef = useRef<HTMLInputElement>(null),
    [dragging, setDragging] = useState(false)

  async function stageMaterialFile(picked: File) {
    setFile(picked)
    setAsset(null)
    upload.clear()
    action.clear()
    await upload.run(
      () => services.files.stage(picked, offeringId, 'MATERIAL'),
      (result) => {
        setAsset(result)
        action.clear()
      },
      'File uploaded. Save the material to attach it.',
    )
  }
  const load = useCallback(
      () => services.content.topics(offeringId, { page, search }),
      [offeringId, page, search],
    ),
    topics = useResource(load, `editor-topics:${offeringId}:${page}:${search}`)
  async function review() {
    if (!saved) return
    await action.run(
      () => services.content.material(saved.resource.id),
      (item) => {
        setTitle(item.resource.title)
        setKind(item.resource.kind)
        setTopicId(String(item.resource.topicId))
        setBody(item.resource.body ?? '')
        setUrl(item.resource.externalUrl ?? '')
        setMandatory(item.mandatory)
        setAsset(item.files[0] ?? null)
        setFile(null)
        setExpected(item.resource.version)
      },
    )
  }
  const focusId = useId()
  useEffect(() => {
    document.getElementById(`${focusId}-${preview ? 'preview' : 'title'}`)?.focus()
  }, [focusId, preview])
  const needsUpload = kind === 'FILE' && !asset
  const busy = action.pending || upload.pending
  function submit(event: FormEvent) {
    event.preventDefault()
    if (busy || needsUpload) return
    const status =
      (event.nativeEvent as SubmitEvent).submitter?.getAttribute('value') === 'PUBLISHED'
        ? 'PUBLISHED'
        : 'DRAFT'
    void action.run(
      () =>
        services.content.saveMaterial(
          offeringId,
          saved?.resource.id ?? null,
          {
            title,
            kind,
            topicId: Number(topicId),
            body: kind === 'TEXT' ? body : null,
            externalUrl: kind === 'LINK' ? url : null,
            fileIds: kind === 'FILE' && asset ? [asset.id] : [],
            status,
            mandatory,
          },
          expected,
        ),
      close,
    )
  }
  return (
    <Dialog
      title={
        preview
          ? 'Preview learning material'
          : saved
            ? 'Edit learning material'
            : 'Create learning material'
      }
      icon={saved ? 'edit' : 'book-small'}
      wide
      close={close}
    >
      {preview ? (
        <div className="material-preview">
          <h3>{title || 'Untitled material'}</h3>
          <p>
            {kind === 'TEXT'
              ? body
              : kind === 'LINK'
                ? url
                : asset
                  ? `${asset.originalName} · ${asset.byteSize.toLocaleString('en-US')} bytes`
                  : 'No uploaded file selected.'}
          </p>
          <Button id={`${focusId}-preview`} tone="secondary" onClick={() => setPreview(false)}>
            Back to editor
          </Button>
        </div>
      ) : (
        <form onSubmit={submit}>
          <Feedback action={action} review={saved ? () => void review() : undefined} />
          <Feedback action={upload} />
          <Select
            label="Content type"
            value={kind}
            onChange={(e) => setKind(e.target.value as Resource['kind'])}
          >
            <option value="TEXT">Text</option>
            <option value="LINK">Link</option>
            <option value="FILE">File</option>
          </Select>
          <Field
            id={`${focusId}-title`}
            label="Title"
            required
            maxLength={200}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Field
            label="Search topics"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
          />
          <LoadState {...topics} retry={topics.reload} />
          <Select
            label="Topic"
            required
            value={topicId}
            onChange={(e) => setTopicId(e.target.value)}
          >
            <option value="">Select a topic</option>
            {topicId && !topics.data?.items.some((t) => t.id === Number(topicId)) && (
              <option value={topicId}>Topic {topicId} · Selected</option>
            )}
            {topics.data?.items.map((t) => (
              <option value={t.id} key={t.id}>
                {t.position}. {t.title}
              </option>
            ))}
          </Select>
          {topics.data && <Pager value={topics.data} change={setPage} />}
          {kind === 'TEXT' && (
            <TextArea
              label="Text content"
              required
              maxLength={50000}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          )}
          {kind === 'LINK' && (
            <Field
              label="URL"
              type="url"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          )}
          {kind === 'FILE' && (
            <div className="file-uploader">
              <div
                className={`upload-dropzone${dragging ? ' is-dragging' : ''}${busy ? ' is-disabled' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault()
                  if (!busy) setDragging(true)
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragging(false)
                  if (busy) return
                  const dropped = e.dataTransfer.files?.[0]
                  if (dropped) void stageMaterialFile(dropped)
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  hidden
                  disabled={busy}
                  onChange={(e) => {
                    const picked = e.target.files?.[0]
                    e.target.value = ''
                    if (picked) void stageMaterialFile(picked)
                  }}
                />
                <div className="upload-dropzone-icon">
                  <UploadCloudIcon />
                </div>
                <p className="upload-dropzone-title">Choose a file or drag &amp; drop it here.</p>
                <p className="upload-dropzone-hint">
                  Up to 50 MB.{!apiMode && ' Demo files are kept until the page reloads.'}
                </p>
                <Button
                  tone="secondary"
                  disabled={busy}
                  onClick={() => fileInputRef.current?.click()}
                >
                  Browse File
                </Button>
              </div>

              {upload.pending && file && (
                <ul className="assessment-files upload-file-list" aria-live="polite">
                  <li className="upload-file-card is-uploading">
                    <span
                      className={`upload-file-badge ${fileBadgeTone(fileExtension(file.name))}`}
                      aria-hidden="true"
                    >
                      {fileExtension(file.name)}
                    </span>
                    <div className="upload-file-info">
                      <strong className="upload-file-name">{file.name}</strong>
                      <div className="upload-file-meta">
                        <span>{formatFileSize(file.size)}</span>
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
                </ul>
              )}

              {asset && (
                <ul className="assessment-files upload-file-list">
                  <li className="upload-file-card">
                    <span
                      className={`upload-file-badge ${fileBadgeTone(fileExtension(asset.originalName))}`}
                      aria-hidden="true"
                    >
                      {fileExtension(asset.originalName)}
                    </span>
                    <div className="upload-file-info">
                      <strong className="upload-file-name">{asset.originalName}</strong>
                      <div className="upload-file-meta">
                        <span>{formatFileSize(asset.byteSize)}</span>
                        <span className="upload-status-completed">
                          <Icon name="check" size={14} />
                          Completed
                        </span>
                      </div>
                    </div>
                    <div className="actions">
                      <Button
                        tone="secondary"
                        disabled={busy}
                        onClick={() => {
                          setFile(null)
                          setAsset(null)
                          upload.clear()
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  </li>
                </ul>
              )}
            </div>
          )}
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={mandatory}
              onChange={(e) => setMandatory(e.target.checked)}
            />
            Mandatory learning material
          </label>
          {saved?.resource.status === 'PUBLISHED' && (
            <p className="form-description">
              Saving as draft hides the material from students until it is published again.
            </p>
          )}
          <div className="actions">
            <ActionButton icon="cancel-dark" tone="secondary" disabled={busy} onClick={close}>
              Cancel
            </ActionButton>
            <ActionButton
              icon="save-dark"
              tone="secondary"
              type="submit"
              value="DRAFT"
              disabled={busy || needsUpload}
            >
              {action.pending ? 'Saving…' : 'Save draft'}
            </ActionButton>
            <ActionButton
              icon="preview"
              tone="secondary"
              disabled={busy}
              onClick={() => setPreview(true)}
            >
              Preview
            </ActionButton>
            <ActionButton
              icon="publish-small"
              type="submit"
              value="PUBLISHED"
              disabled={busy || needsUpload}
            >
              {action.pending ? 'Saving…' : 'Publish'}
            </ActionButton>
          </div>
        </form>
      )}
    </Dialog>
  )
}
