import { ActionButton as Button } from '@/components/workspace/WorkspaceUI'
import { useCallback, useState } from 'react'
import { Dialog, Field, Status } from '@/components/ui'
import { Feedback, LoadState } from '@/components/workspace/WorkspaceUI'
import { services } from '@/services'
import { useAction } from '@/services/use-action'
import { useResource } from '@/services/use-resource'
import type { GroupView } from '@/services/assessment-contracts'
export function GroupEditor({
  assignmentId,
  group,
  close,
}: {
  assignmentId: number
  group?: GroupView
  close(): void
}) {
  const [snapshot] = useState(group),
    [name, setName] = useState(group?.group.name ?? ''),
    [ids, setIds] = useState(group?.group.memberStudentIds ?? []),
    action = useAction(),
    load = useCallback(() => services.assessment.candidates(assignmentId), [assignmentId]),
    result = useResource(load, `group-candidates:${assignmentId}`)
  return (
    <Dialog title={group ? 'Edit group' : 'Create group'} close={close}>
      <Status>
        Members can belong to one group per assignment. Assigned locked accounts remain recipients
        when the group freezes.
      </Status>
      <Feedback action={action} />
      <Field
        label="Group name"
        maxLength={120}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <LoadState {...result} retry={result.reload} />
      <fieldset className="account-options">
        <legend>Assigned students</legend>
        {result.data?.map((a) => (
          <label key={a.id}>
            <input
              type="checkbox"
              checked={ids.includes(a.id)}
              onChange={(e) =>
                setIds((old) =>
                  e.target.checked ? [...old, a.id] : old.filter((id) => id !== a.id),
                )
              }
            />
            {a.displayName} · {a.id} · {a.status.toLowerCase()}
          </label>
        ))}
      </fieldset>
      <div className="actions">
        <Button icon="cancel-dark" tone="secondary" disabled={action.pending} onClick={close}>
          Cancel
        </Button>
        <Button
          icon="complete-white"
          disabled={action.pending || !!result.error}
          onClick={() =>
            void action.run(
              () =>
                services.assessment.saveGroup(
                  assignmentId,
                  snapshot?.group.id ?? null,
                  { name, memberStudentIds: ids },
                  snapshot?.group.version,
                ),
              close,
            )
          }
        >
          Save group
        </Button>
      </div>
    </Dialog>
  )
}
