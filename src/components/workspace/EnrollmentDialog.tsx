import { useState, type FormEvent } from 'react'
import { Dialog } from '@/components/ui'
import { AccountPicker } from '@/components/workspace/AccountPicker'
import { ActionButton, Feedback } from '@/components/workspace/WorkspaceUI'
import type { AccountSummary } from '@/services/contracts'
import { services } from '@/services'
import { useAction } from '@/services/use-action'

export function EnrollmentDialog({ id, close }: { id: number; close(): void }) {
  const [selected, setSelected] = useState<AccountSummary | null>(null),
    action = useAction()
  function submit(event: FormEvent) {
    event.preventDefault()
    if (selected) void action.run(() => services.courses.enroll(id, selected.id), close)
  }
  return (
    <Dialog title="Add existing student" wide icon="info" close={close}>
      <form onSubmit={submit}>
        <Feedback action={action} />
        <AccountPicker offeringId={id} role="STUDENT" selected={selected} change={setSelected} />
        <div className="actions">
          <ActionButton
            icon="cancel-dark"
            tone="secondary"
            disabled={action.pending}
            onClick={close}
          >
            Cancel
          </ActionButton>
          <ActionButton icon="user-add-white" type="submit" disabled={action.pending || !selected}>
            {action.pending ? 'Adding…' : 'Add student'}
          </ActionButton>
        </div>
      </form>
    </Dialog>
  )
}
