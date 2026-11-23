import { useState } from 'react'
import { Link } from 'react-router'
import { Button, Dialog, Field, Status } from '@/components/ui'
import { Feedback, Select, TextArea } from '@/components/workspace/WorkspaceUI'
import { services } from '@/services'
import type { AdminAccount, CredentialDelivery } from '@/services/admin-contracts'
import { mustReview } from '@/services/errors'
import type { Role } from '@/services/contracts'
import { useAction } from '@/services/use-action'
export type AccountOperation = 'create' | 'reset' | 'lock' | 'unlock' | 'capability'
export function AccountDialog({
  kind,
  account,
  close,
  reload,
}: {
  kind: AccountOperation
  account?: AdminAccount
  reload(): void
  close(): void
}) {
  const [email, setEmail] = useState(''),
    [name, setName] = useState(''),
    [role, setRole] = useState<Role>('STUDENT'),
    [capability, setCapability] = useState(account?.canCreateCourse ?? false),
    [reason, setReason] = useState(''),
    [delivery, setDelivery] = useState<CredentialDelivery | null>(null),
    [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle'),
    action = useAction(),
    labels = {
      create: 'Issue account',
      reset: 'Reset temporary password',
      lock: 'Lock account',
      unlock: 'Unlock account',
      capability: 'Manage course-creation permission',
    }
  async function save() {
    if (kind === 'create') {
      const r = await services.admin.provision({
        email,
        displayName: name,
        role,
        canCreateCourse: role === 'INSTRUCTOR' && capability,
      })
      setDelivery(r)
      return
    }
    if (kind === 'reset') {
      const r = await services.admin.resetPassword(account!.account.id, reason, account!.version)
      setDelivery(r)
      return
    }
    await services.admin.update(account!.account.id, {
      expectedVersion: account!.version,
      reason,
      ...(kind === 'capability'
        ? { canCreateCourse: capability }
        : { status: kind === 'lock' ? ('LOCKED' as const) : ('ACTIVE' as const) }),
    })
    close()
  }
  return (
    <Dialog title={labels[kind]} close={close} icon="people-small">
      <Feedback
        action={action}
        review={() => {
          reload()
          close()
        }}
      />
      {delivery ? (
        <>
          {delivery.temporaryPassword ? (
            <>
              {/* <Status>
                Copy this temporary password before closing. It cannot be viewed again here.
              </Status> */}
              <Field
                label="Temporary password"
                value={delivery.temporaryPassword}
                readOnly
                autoComplete="off"
              />
              <Button
                tone="secondary"
                onClick={() => {
                  void navigator.clipboard.writeText(delivery.temporaryPassword!).then(
                    () => setCopyState('copied'),
                    () => setCopyState('failed'),
                  )
                }}
              >
                {copyState === 'copied' ? 'Copied' : 'Copy password'}
              </Button>
              {copyState === 'failed' && (
                <Status>Could not copy. Select and copy the password above.</Status>
              )}
            </>
          ) : (
            <Status>
              Temporary password sent to the operator outbox for account {delivery.accountId}.
            </Status>
          )}
          <p>{account?.email ?? email.trim().toLowerCase()}</p>
          <p>A password change is required at the next sign-in.</p>
          <Button onClick={close}>Done</Button>
        </>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void action.run(save)
          }}
        >
          {kind === 'create' ? (
            <>
              <Field
                label="Email"
                type="email"
                required
                maxLength={254}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Field
                label="Display name"
                required
                maxLength={120}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <Select
                label="System role"
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
              >
                <option value="STUDENT">Student</option>
                <option value="INSTRUCTOR">Instructor</option>
                <option value="ADMIN">Administrator</option>
              </Select>
              {role === 'INSTRUCTOR' && (
                <Select
                  label="Can create course sections"
                  value={String(capability)}
                  onChange={(e) => setCapability(e.target.value === 'true')}
                >
                  <option value="false">Not granted</option>
                  <option value="true">Granted</option>
                </Select>
              )}
            </>
          ) : (
            <>
              <p>
                {account!.account.displayName} · {account!.email}
              </p>
              {kind === 'capability' && (
                <Select
                  label="Can create course sections"
                  value={String(capability)}
                  onChange={(e) => setCapability(e.target.value === 'true')}
                >
                  <option value="false">Not granted</option>
                  <option value="true">Granted</option>
                </Select>
              )}
              {kind === 'lock' && (
                <>
                  <p>
                    The account loses sign-in and participation access. Historical records remain.
                  </p>
                  {!!account!.leadResponsibilities?.length && (
                    <Status error>
                      Transfer these Draft/Open lead responsibilities first:
                      {account!.leadResponsibilities.map((o) => (
                        <p key={o.id}>
                          <Link to={`/offerings/${o.id}/team`}>{o.title} · Manage team</Link>
                        </p>
                      ))}
                    </Status>
                  )}
                </>
              )}
              {kind === 'unlock' && (
                <p>Sign-in becomes available. Existing enrollment is unchanged.</p>
              )}
              {kind === 'reset' && (
                <p>
                  A temporary password must be changed at next login. Existing sessions are
                  invalidated.
                </p>
              )}
              <TextArea
                label="Reason"
                required
                maxLength={1000}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </>
          )}
          <div className="actions">
            <Button tone="secondary" disabled={action.pending} onClick={close}>
              Cancel
            </Button>
            <Button type="submit" disabled={action.pending || mustReview(action.error)}>
              {action.pending
                ? 'Saving…'
                : kind === 'create'
                  ? 'Create account'
                  : kind === 'capability'
                    ? 'Save permission'
                    : labels[kind]}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  )
}
