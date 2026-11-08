import { useState } from 'react'
import { Link } from 'react-router'
import { Button, Dialog, Field, Status } from '@/components/ui'
import { Feedback, Select, TextArea } from '@/components/workspace/WorkspaceUI'
import { services } from '@/services'
import type { MeView, Role } from '@/services/contracts'
import { useAction } from '@/services/use-action'
export type AccountOperation = 'create' | 'reset' | 'lock' | 'unlock' | 'capability'
export function AccountDialog({
  kind,
  account,
  close,
}: {
  kind: AccountOperation
  account?: MeView & { leadResponsibilities: { id: number; title: string }[] }
  close(): void
}) {
  const [email, setEmail] = useState(''),
    [name, setName] = useState(''),
    [role, setRole] = useState<Role>('STUDENT'),
    [capability, setCapability] = useState(account?.canCreateCourse ?? false),
    [reason, setReason] = useState(''),
    [delivery, setDelivery] = useState<{ email: string; password: string } | null>(null),
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
      setDelivery({ email: r.account.email, password: r.temporaryPassword })
      return
    }
    if (kind === 'reset') {
      const r = await services.admin.resetPassword(account!.account.id, reason, account!.version)
      setDelivery({ email: r.account.email, password: r.temporaryPassword })
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
      <Feedback action={action} review={close} />
      {delivery ? (
        <>
          <Status>
            Demo credential delivery · shown once. Closing this dialog discards the plaintext
            credential.
          </Status>
          <p>{delivery.email}</p>
          <Field
            label="Temporary demo password"
            value={delivery.password}
            readOnly
            autoComplete="off"
          />
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
                  {account!.leadResponsibilities.length > 0 && (
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
            <Button type="submit" disabled={action.pending}>
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
