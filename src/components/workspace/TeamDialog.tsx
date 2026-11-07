import { useCallback, useState, type FormEvent } from 'react'
import { Dialog, Field } from '@/components/ui'
import { AccountPicker } from '@/components/workspace/AccountPicker'
import {
  ActionButton,
  Feedback,
  LoadState,
  Pager,
  Select,
  TextArea,
} from '@/components/workspace/WorkspaceUI'
import type { AccountSummary, Membership } from '@/services/contracts'
import type { OfferingView } from '@/services/course-contracts'
import { services } from '@/services'
import { useAction } from '@/services/use-action'
import { useResource } from '@/services/use-resource'

export function TeamDialog({
  view,
  mode,
  initial,
  close,
}: {
  view: OfferingView
  mode: 'add' | 'remove' | 'transfer'
  initial?: Membership
  close(): void
}) {
  const id = view.offering.id,
    [selected, setSelected] = useState<AccountSummary | null>(null),
    [target, setTarget] = useState<Membership | null>(initial ?? null),
    [reason, setReason] = useState(''),
    [password, setPassword] = useState(''),
    [expected, setExpected] = useState(view.offering.version),
    [page, setPage] = useState(1),
    action = useAction()
  const load = useCallback(() => services.courses.team(id, { page }), [id, page]),
    result = useResource(load, `team-picker:${id}:${page}`)
  const eligible =
    result.data?.items.filter(
      (m) =>
        m.status === 'ACTIVE' &&
        m.teachingRole === 'CO_INSTRUCTOR' &&
        (mode !== 'transfer' || m.account.status === 'ACTIVE'),
    ) ?? []
  async function review() {
    await action.run(
      () => services.courses.get(id),
      (latest) => {
        setExpected(latest.offering.version)
        setReason('')
        setPassword('')
        setTarget(null)
        setSelected(null)
        result.reload()
      },
    )
  }
  function submit(event: FormEvent) {
    event.preventDefault()
    void action.run(
      () =>
        mode === 'add'
          ? services.courses.addInstructor(id, selected!.id, reason, expected)
          : mode === 'remove'
            ? services.courses.removeInstructor(id, target!.id, reason, expected)
            : services.courses.transfer(id, target!.id, reason, password, expected),
      close,
    )
  }
  const title =
    mode === 'add'
      ? 'Add instructor'
      : mode === 'remove'
        ? 'Remove co-instructor'
        : 'Transfer lead instructor'
  return (
    <Dialog title={title} icon="info" wide close={close}>
      <form onSubmit={submit}>
        <Feedback action={action} review={() => void review()} />
        <p className="form-description">
          {mode === 'transfer'
            ? `Current lead: ${view.lead?.displayName ?? 'Unavailable'}. The new lead gains all lead responsibilities; the previous lead becomes a co-instructor. Exactly one lead remains.`
            : mode === 'remove'
              ? 'Current access is revoked immediately. Historical submissions, grades and teaching history remain unchanged.'
              : 'Select an eligible active instructor. Team membership does not grant global course creation capability.'}
        </p>
        {view.permissions.repairLead && <StatusRepair />}
        {mode === 'add' ? (
          <AccountPicker
            offeringId={id}
            role="INSTRUCTOR"
            selected={selected}
            change={setSelected}
          />
        ) : (
          <>
            <LoadState {...result} retry={result.reload} />
            <Select
              label={mode === 'transfer' ? 'New lead instructor' : 'Co-instructor'}
              required
              value={target?.id ?? ''}
              onChange={(e) =>
                setTarget(eligible.find((m) => m.id === Number(e.target.value)) ?? null)
              }
            >
              <option value="">Select a current co-instructor</option>
              {target && !eligible.some((m) => m.id === target.id) && (
                <option value={target.id}>
                  {target.account.displayName} · Previously selected
                </option>
              )}
              {eligible.map((m) => (
                <option value={m.id} key={m.id}>
                  {m.account.displayName} · {m.account.id} · {m.account.status.toLowerCase()}
                </option>
              ))}
            </Select>
            {result.data && <Pager value={result.data} change={setPage} />}
          </>
        )}
        <TextArea
          label="Reason"
          maxLength={1000}
          required={mode !== 'add' || !view.permissions.academic}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        {mode === 'transfer' && (
          <Field
            label="Your current password"
            type="password"
            autoComplete="current-password"
            required
            maxLength={1024}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
            danger={mode !== 'add'}
            icon={
              mode === 'add'
                ? 'user-add-white'
                : mode === 'remove'
                  ? 'trash-white'
                  : 'publish-small'
            }
            type="submit"
            disabled={action.pending || (mode === 'add' ? !selected : !target)}
          >
            {action.pending ? 'Please wait…' : mode === 'transfer' ? 'Confirm transfer' : title}
          </ActionButton>
        </div>
      </form>
    </Dialog>
  )
}
function StatusRepair() {
  return (
    <p className="form-description">
      Operational repair only: add an active instructor, then transfer leadership before restoring
      this archived section. Academic content stays read-only.
    </p>
  )
}
