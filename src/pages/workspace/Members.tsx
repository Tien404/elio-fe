import { useCallback, useState } from 'react'
import { DataTable, Field, Panel, Status } from '@/components/ui'
import {
  ActionButton,
  Badge,
  ConfirmDialog,
  LoadState,
  Pager,
  Select,
} from '@/components/workspace/WorkspaceUI'
import { EnrollmentDialog } from '@/components/workspace/EnrollmentDialog'
import { useOffering } from '@/pages/workspace/offering-context'
import { services, apiMode } from '@/services'
import { useResource } from '@/services/use-resource'
import type { Membership } from '@/services/contracts'

export function Members() {
  const { view, refreshing } = useOffering(),
    id = view.offering.id
  const [search, setSearch] = useState(''),
    [status, setStatus] = useState<Membership['status'] | ''>(''),
    [page, setPage] = useState(1),
    [add, setAdd] = useState(false),
    [command, setCommand] = useState<{ action: 'rotate' | 'disable'; expected: number }>(),
    [details, setDetails] = useState<Membership>()
  const load = useCallback(
      () => services.courses.members(id, { search, status, page }),
      [id, search, status, page],
    ),
    result = useResource(load, `roster:${id}:${search}:${status}:${page}`)
  return (
    <>
      <h1>{view.permissions.enroll ? 'Roster management' : 'Course members'}</h1>
      <Panel
        title="Course members"
        icon="people"
        actions={
          view.permissions.enroll ? (
            <ActionButton icon="user-add-white" onClick={() => setAdd(true)}>
              Add student
            </ActionButton>
          ) : undefined
        }
      >
        <p>
          {view.offering.courseCode} · {view.offering.title} · {view.offering.sectionCode} ·{' '}
          {view.offering.semester}
        </p>
        <div className="filters">
          <Field
            label="Search account"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
          />
          <Select
            label="Membership status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as Membership['status'] | '')
              setPage(1)
            }}
          >
            <option value="">All available memberships</option>
            <option value="ACTIVE">Active</option>
            <option value="REMOVED">Removed</option>
          </Select>
        </div>
        <LoadState {...result} retry={result.reload} />
        {result.data && (
          <>
            {result.data.items.length ? (
              <DataTable
                rows={result.data.items}
                rowKey={(m) => m.id}
                columns={[
                  {
                    label: 'Student',
                    render: (m) => (
                      <button type="button" className="link-button" onClick={() => setDetails(m)}>
                        {m.account.displayName}
                      </button>
                    ),
                  },
                  { label: 'Identifier', render: (m) => m.account.id },
                  {
                    label: 'Membership',
                    render: (m) => (
                      <>
                        <Badge value={m.status} />
                        {m.account.status === 'LOCKED' && <Badge value="LOCKED" />}
                      </>
                    ),
                  },
                ]}
              />
            ) : (
              <Status>No members match your filters.</Status>
            )}
            <Pager value={result.data} change={setPage} />
          </>
        )}
      </Panel>
      {(view.joinCode || view.permissions.manageCode) && (
        <Panel title="Join code" icon="info">
          <p>
            <strong className="join-code">{view.joinCode ?? 'Not generated'}</strong> ·{' '}
            {view.joinEnabled ? 'Enabled' : 'Disabled or unavailable while not open'}
          </p>
          <p>
            A changed code invalidates the old code immediately. Existing enrollment is preserved.
            {!apiMode && (
              <>
                Share the section ID <strong>{id}</strong> with the code.
              </>
            )}
          </p>
          <div className="actions">
            {view.permissions.manageCode ? (
              <>
                <ActionButton
                  tone="secondary"
                  icon="refresh"
                  disabled={refreshing}
                  onClick={() => setCommand({ action: 'rotate', expected: view.offering.version })}
                >
                  Regenerate code
                </ActionButton>
                <ActionButton
                  icon="close-white"
                  disabled={refreshing || !view.joinEnabled}
                  onClick={() => setCommand({ action: 'disable', expected: view.offering.version })}
                >
                  Disable code
                </ActionButton>
              </>
            ) : (
              <p>Only the current lead can change the join code.</p>
            )}
          </div>
        </Panel>
      )}
      {add && <EnrollmentDialog id={id} close={() => setAdd(false)} />}
      {command && (
        <ConfirmDialog
          title={command.action === 'rotate' ? 'Regenerate join code?' : 'Disable join code?'}
          confirm={command.action === 'rotate' ? 'Regenerate code' : 'Disable code'}
          close={() => setCommand(undefined)}
          run={() => services.courses.joinCode(id, command.action, command.expected)}
        >
          <p>
            {command.action === 'rotate'
              ? 'A new enabled code replaces the current code immediately.'
              : 'Students cannot join using this code until a new code is generated.'}{' '}
            Current memberships will not change. If a conflict occurs, cancel and review the latest
            section before confirming again.
          </p>
        </ConfirmDialog>
      )}
      {details && (
        <ConfirmDialog
          title="Membership details"
          confirm="Close"
          close={() => setDetails(undefined)}
          run={async () => undefined}
        >
          <p>
            {details.account.displayName} · Account {details.account.id}
          </p>
          <p>
            Membership: {details.status.toLowerCase()} · Account:{' '}
            {details.account.status.toLowerCase()}.
          </p>
          <p>Account locking does not remove historical membership or group recipients.</p>
        </ConfirmDialog>
      )}
    </>
  )
}
