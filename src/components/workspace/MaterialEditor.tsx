import { useCallback, useEffect, useId, useState, type FormEvent } from 'react'
import { Button, Dialog, Field } from '@/components/ui'
import {
  ActionButton,
  Feedback,
  LoadState,
  Pager,
  Select,
  TextArea,
} from '@/components/workspace/WorkspaceUI'
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
    upload = useAction()
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
              <Field
                label="Material file"
                type="file"
                disabled={busy}
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null)
                  setAsset(null)
                  upload.clear()
                  action.clear()
                }}
              />
              <p>
                Up to 50 MB. Choose a file, then click Upload file before saving or publishing.
                {!apiMode && ' Demo files are kept until the page reloads.'}
              </p>
              {file && !asset && !upload.pending && <p>File selected. Click Upload file.</p>}
              {asset && (
                <p>
                  {asset.originalName} · {asset.byteSize.toLocaleString('en-US')} bytes ·{' '}
                  {asset.state.toLowerCase()}
                </p>
              )}
              <ActionButton
                tone="secondary"
                disabled={busy || !file || !!asset}
                onClick={() =>
                  file &&
                  void upload.run(
                    () => services.files.stage(file, offeringId, 'MATERIAL'),
                    (result) => {
                      setAsset(result)
                      action.clear()
                    },
                    'File uploaded. Save the material to attach it.',
                  )
                }
              >
                {upload.pending ? 'Uploading…' : 'Upload file'}
              </ActionButton>
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
