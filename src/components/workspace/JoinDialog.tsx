import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { Dialog, Field } from '@/components/ui'
import { ActionButton, Feedback } from '@/components/workspace/WorkspaceUI'
import { services, apiMode } from '@/services'
import { useAction } from '@/services/use-action'

export function JoinDialog({ close, offeringId }: { close(): void; offeringId?: number }) {
  const [section, setSection] = useState(offeringId ? String(offeringId) : '')
  const [code, setCode] = useState('')
  const action = useAction(),
    navigate = useNavigate()
  function submit(event: FormEvent) {
    event.preventDefault()
    void action.run(
      () => services.courses.join(Number(section), code),
      (value) => {
        close()
        navigate(`/offerings/${value.offering.id}`)
      },
    )
  }
  return (
    <Dialog title="Join a course section" icon="book-small" wide close={close}>
      <form onSubmit={submit}>
        <Feedback action={action} />
        {!apiMode && (
          <Field
            label="Course section ID"
            type="number"
            min={1}
            step={1}
            required
            value={section}
            onChange={(e) => setSection(e.target.value)}
          />
        )}
        <Field
          label="Join code"
          required
          minLength={6}
          maxLength={6}
          pattern="[A-Za-z0-9]{6}"
          autoComplete="off"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
        />
        <div className="actions">
          <ActionButton tone="secondary" disabled={action.pending} onClick={close}>
            Cancel
          </ActionButton>
          <ActionButton type="submit" disabled={action.pending}>
            {action.pending ? 'Joining…' : 'Join section'}
          </ActionButton>
        </div>
      </form>
    </Dialog>
  )
}
