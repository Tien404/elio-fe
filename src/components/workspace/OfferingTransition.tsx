import { useState, type FormEvent } from 'react'
import { Dialog } from '@/components/ui'
import { ActionButton, Feedback, TextArea } from '@/components/workspace/WorkspaceUI'
import type { OfferingView } from '@/services/course-contracts'
import { services } from '@/services'
import { mustReview } from '@/services/errors'
import { useAction } from '@/services/use-action'

export function OfferingTransition({
  item,
  command,
  close,
  reload,
}: {
  item: OfferingView
  command: 'publish' | 'archive' | 'restore'
  close(): void
  reload(): void
}) {
  const [expected] = useState(item.offering.version)
  const [reason, setReason] = useState(''),
    action = useAction()
  const label = command[0].toUpperCase() + command.slice(1)
  function submit(event: FormEvent) {
    event.preventDefault()
    void action.run(
      () => services.courses.transition(item.offering.id, command, reason, expected),
      close,
    )
  }
  return (
    <Dialog
      title={`${label} ${item.offering.courseCode} · ${item.offering.sectionCode}?`}
      icon={command === 'archive' ? 'archive' : command === 'publish' ? 'publish' : 'unlock'}
      wide
      close={close}
    >
      <form onSubmit={submit}>
        <Feedback
          action={action}
          review={() => {
            reload()
            close()
          }}
        />
        <p className="form-description">
          {command === 'publish'
            ? 'The course section becomes open. Students can join using its enabled code.'
            : command === 'archive'
              ? 'Academic changes and joining stop. Existing content, deadlines and history are preserved. Quiz attempts must have finalized successfully.'
              : 'An active lead is required. Restoring preserves all original deadlines and history.'}
        </p>
        {command !== 'publish' && (
          <TextArea
            label="Reason"
            required
            maxLength={1000}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
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
          <ActionButton
            danger={command === 'archive'}
            icon={
              command === 'archive'
                ? 'archive-white'
                : command === 'restore'
                  ? 'unlock'
                  : 'publish-small'
            }
            type="submit"
            disabled={action.pending || mustReview(action.error)}
          >
            {action.pending ? 'Please wait…' : `Confirm ${command}`}
          </ActionButton>
        </div>
      </form>
    </Dialog>
  )
}
