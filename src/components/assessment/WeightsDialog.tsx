import { ActionButton as Button } from '@/components/workspace/WorkspaceUI'
import { useState } from 'react'
import { Dialog, Field, Status } from '@/components/ui'
import { Feedback } from '@/components/workspace/WorkspaceUI'
import { apiMode, services } from '@/services'
import { mustReview } from '@/services/errors'
import { useAction } from '@/services/use-action'
import type { GradebookView } from '@/services/assessment-contracts'
export function WeightsDialog({
  offeringId,
  view,
  close,
}: {
  offeringId: number
  view: GradebookView
  close(): void
}) {
  const [snapshot] = useState(view),
    [values, setValues] = useState(
      view.activities.map((a) => ({ id: a.activityId, kind: a.kind, weight: a.weight })),
    ),
    action = useAction(),
    total = values.reduce((s, v) => s + Math.round(v.weight * 100), 0) / 100,
    valid =
      values.length > 0 &&
      values.every(
        ({ weight }) =>
          weight >= 0 &&
          weight <= 100 &&
          Math.abs(weight * 100 - Math.round(weight * 100)) < 0.000001,
      ) &&
      (!apiMode || total === 100)
  return (
    <Dialog title="Activity weights" close={close}>
      <Feedback action={action} review={close} />
      <Status>
        Total weight: {total}%.{' '}
        {apiMode ? 'The total must be 100%.' : 'Other totals are saved as provisional.'}
      </Status>
      {snapshot.activities.map((a, i) => (
        <Field
          key={`${a.kind}:${a.activityId}`}
          label={`${a.title} · ${a.kind.toLowerCase()} (%)`}
          type="number"
          min={0}
          max={100}
          step="0.01"
          value={values[i].weight}
          onChange={(e) =>
            setValues((old) =>
              old.map((v, j) => (i === j ? { ...v, weight: Number(e.target.value) } : v)),
            )
          }
        />
      ))}
      <div className="actions">
        <Button icon="cancel-dark" tone="secondary" disabled={action.pending} onClick={close}>
          Cancel
        </Button>
        <Button
          icon="complete-white"
          disabled={action.pending || !valid || mustReview(action.error)}
          onClick={() =>
            void action.run(
              () => services.assessment.weights(offeringId, values, snapshot.version),
              close,
            )
          }
        >
          Save weights
        </Button>
      </div>
    </Dialog>
  )
}
