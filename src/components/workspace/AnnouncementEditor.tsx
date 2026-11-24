import { apiMode } from '@/services'
import { useEffect, useId, useState, type FormEvent } from 'react'
import { Button, Dialog, Field } from '@/components/ui'
import { ActionButton, Feedback, TextArea } from '@/components/workspace/WorkspaceUI'
import type { AnnouncementView } from '@/services/course-contracts'
import { services } from '@/services'
import { mustReview } from '@/services/errors'
import { useAction } from '@/services/use-action'

export function AnnouncementEditor({
  offeringId,
  saved,
  canPublish,
  close,
}: {
  offeringId: number
  saved?: AnnouncementView
  canPublish: boolean
  close(): void
}) {
  const [snapshot, setSnapshot] = useState(saved)
  const [title, setTitle] = useState(saved?.title ?? ''),
    [body, setBody] = useState(saved?.body ?? ''),
    [preview, setPreview] = useState(false),
    action = useAction()
  const focusId = useId()
  useEffect(() => {
    document.getElementById(`${focusId}-${preview ? 'preview' : 'title'}`)?.focus()
  }, [focusId, preview])
  function submit(event: FormEvent) {
    event.preventDefault()
    const publish =
      apiMode || (event.nativeEvent as SubmitEvent).submitter?.getAttribute('value') === 'publish'
    if (action.pending || mustReview(action.error) || (publish && !canPublish)) return
    void action.run(
      () =>
        services.content.saveAnnouncement(
          offeringId,
          snapshot?.id ?? null,
          { title, body },
          publish,
          snapshot?.version,
        ),
      close,
    )
  }
  return (
    <Dialog
      title={preview ? 'Announcement preview' : 'Class announcement'}
      wide
      icon="announcements"
      close={close}
    >
      {preview ? (
        <div className="material-preview">
          <h3>{title || 'Untitled announcement'}</h3>
          <p>{body}</p>
          <Button id={`${focusId}-preview`} tone="secondary" onClick={() => setPreview(false)}>
            Back to editor
          </Button>
        </div>
      ) : (
        <form onSubmit={submit}>
          <Feedback
            action={action}
            review={
              snapshot
                ? () =>
                    void action.run(
                      () => services.content.announcement(snapshot.id),
                      (fresh) => {
                        setSnapshot(fresh)
                        setTitle(fresh.title)
                        setBody(fresh.body)
                      },
                    )
                : undefined
            }
          />
          <Field
            id={`${focusId}-title`}
            label="Title"
            required
            maxLength={200}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <TextArea
            label="Content"
            required
            maxLength={10000}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          {snapshot?.status === 'PUBLISHED' && (
            <p className="form-description">
              Draft changes stay private to instructors. Students keep seeing the previously
              published announcement until you publish again.
            </p>
          )}
          <div className="actions">
            <ActionButton
              icon="cancel-dark"
              tone="secondary"
              disabled={action.pending}
              onClick={close}
            >
              Cancel
            </ActionButton>
            {!apiMode && (
              <ActionButton
                tone="secondary"
                icon="save-dark"
                type="submit"
                value="draft"
                disabled={action.pending || mustReview(action.error)}
              >
                {action.pending ? 'Saving…' : 'Save draft'}
              </ActionButton>
            )}
            <ActionButton
              tone="secondary"
              icon="preview"
              disabled={action.pending}
              onClick={() => setPreview(true)}
            >
              Preview
            </ActionButton>
            {canPublish && (
              <ActionButton
                icon="publish-small"
                type="submit"
                value="publish"
                disabled={action.pending || mustReview(action.error)}
              >
                {action.pending ? 'Saving…' : 'Publish'}
              </ActionButton>
            )}
          </div>
        </form>
      )}
    </Dialog>
  )
}
