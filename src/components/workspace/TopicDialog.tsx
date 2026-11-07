import { useState, type FormEvent } from 'react'
import { Dialog, Field } from '@/components/ui'
import { ActionButton, Feedback } from '@/components/workspace/WorkspaceUI'
import type { Topic } from '@/services/course-contracts'
import { services } from '@/services'
import { useAction } from '@/services/use-action'

export function TopicDialog({
  offeringId,
  topic,
  close,
}: {
  offeringId: number
  topic?: Topic
  close(): void
}) {
  const [title, setTitle] = useState(topic?.title ?? ''),
    [position, setPosition] = useState(String(topic?.position ?? 1)),
    action = useAction()
  function submit(event: FormEvent) {
    event.preventDefault()
    void action.run(
      () =>
        topic
          ? services.content.updateTopic(
              topic.id,
              { title, position: Number(position) },
              topic.version,
            )
          : services.content.createTopic(offeringId, { title, position: Number(position) }),
      close,
    )
  }
  return (
    <Dialog title={topic ? 'Edit topic' : 'Create topic'} icon="messages" wide close={close}>
      <form onSubmit={submit}>
        <Feedback action={action} />
        <Field
          label="Title"
          required
          maxLength={200}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <Field
          label="Order"
          type="number"
          min={1}
          step={1}
          required
          value={position}
          onChange={(e) => setPosition(e.target.value)}
        />
        {action.error && (
          <p className="form-description">
            For a conflict, cancel and review the latest topic order before editing again. Your
            input is kept here.
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
          <ActionButton icon="save" type="submit" disabled={action.pending}>
            {action.pending ? 'Saving…' : 'Save topic'}
          </ActionButton>
        </div>
      </form>
    </Dialog>
  )
}
