import { formatInstant } from '@/services/presentation'
import { useCallback, useState } from 'react'
import { Button, DataTable, Panel, Status } from '@/components/ui'
import { ActionButton, Badge, LoadState, Pager } from '@/components/workspace/WorkspaceUI'
import { TeamDialog } from '@/components/workspace/TeamDialog'
import { useOffering } from '@/pages/workspace/offering-context'
import type { Membership } from '@/services/contracts'
import { services } from '@/services'
import { useResource } from '@/services/use-resource'
import { useAuth } from '@/services/auth-context'

export function Team() {
  const { view, refreshing, reload } = useOffering(),
    { identity } = useAuth(),
    id = view.offering.id,
    [page, setPage] = useState(1),
    [dialog, setDialog] = useState<{ mode: 'add' | 'remove' | 'transfer'; member?: Membership }>()
  const load = useCallback(() => services.courses.team(id, { page }), [id, page]),
    result = useResource(load, `team:${id}:${page}`)
  const manage = view.permissions.manageTeam || view.permissions.repairLead
  return (
    <>
      <h1>Instructor team</h1>
      <Panel title="Instructor team" icon="people">
        <p>Manage the instructors teaching this course section.</p>
        <LoadState {...result} retry={result.reload} />
        {result.data && (
          <>
            {result.data.items.length ? (
              <DataTable
                rows={result.data.items}
                rowKey={(m) => m.id}
                columns={[
                  {
                    label: 'Instructor',
                    render: (m) => (
                      <>
                        {m.account.displayName}
                        <small className="cell-detail">Account {m.account.id}</small>
                      </>
                    ),
                  },
                  {
                    label: 'Role',
                    render: (m) => (
                      <>
                        {m.teachingRole === 'LEAD' ? 'Lead instructor' : 'Co-instructor'}
                        <small className="cell-detail">
                          <Badge value={m.status} />
                          {m.account.status === 'LOCKED' && <Badge value="LOCKED" />}
                        </small>
                      </>
                    ),
                  },
                  {
                    label: 'Responsibilities',
                    render: (m) =>
                      m.teachingRole === 'LEAD'
                        ? 'Course operations, teaching and assessment'
                        : 'Teaching, materials and assessment',
                  },
                  ...(manage
                    ? [
                        {
                          label: 'Actions',
                          render: (m: Membership) =>
                            m.status === 'ACTIVE' && m.teachingRole === 'CO_INSTRUCTOR' ? (
                              <div className="table-actions">
                                {!view.permissions.repairLead && (
                                  <Button
                                    tone="secondary"
                                    disabled={refreshing}
                                    onClick={() => setDialog({ mode: 'remove', member: m })}
                                  >
                                    Remove
                                  </Button>
                                )}
                                {m.account.status === 'ACTIVE' && (
                                  <Button
                                    tone="secondary"
                                    disabled={refreshing}
                                    onClick={() => setDialog({ mode: 'transfer', member: m })}
                                  >
                                    Transfer lead
                                  </Button>
                                )}
                              </div>
                            ) : null,
                        },
                      ]
                    : []),
                ]}
              />
            ) : (
              <Status>No instructors are available.</Status>
            )}
            <Pager value={result.data} change={setPage} />
          </>
        )}
      </Panel>
      {manage && (
        <Panel title="Manage team" icon="people">
          <p>
            Only the current lead instructor or an authorized administrator can change the team.
          </p>
          {view.permissions.repairLead && (
            <Status>
              Restore is blocked. Use operational repair to add an active instructor and transfer
              leadership first.
            </Status>
          )}
          <div className="actions">
            <ActionButton
              tone="secondary"
              icon="user-add"
              disabled={refreshing}
              onClick={() => setDialog({ mode: 'add' })}
            >
              Add instructor
            </ActionButton>
            {!view.permissions.repairLead && (
              <ActionButton
                danger
                icon="trash-white"
                disabled={refreshing}
                onClick={() => setDialog({ mode: 'remove' })}
              >
                Remove co-instructor
              </ActionButton>
            )}
            <ActionButton
              icon="transfer-white"
              disabled={refreshing}
              onClick={() => setDialog({ mode: 'transfer' })}
            >
              Transfer lead instructor
            </ActionButton>
          </div>
        </Panel>
      )}
      {(identity!.me.account.role === 'ADMIN' || view.teachingRole === 'LEAD') && (
        <AuditPanel id={id} />
      )}
      {dialog && (
        <TeamDialog
          view={view}
          mode={dialog.mode}
          initial={dialog.member}
          close={() => setDialog(undefined)}
          review={() => {
            reload()
            result.reload()
            setDialog(undefined)
          }}
        />
      )}
    </>
  )
}
function AuditPanel({ id }: { id: number }) {
  const [page, setPage] = useState(1),
    load = useCallback(() => services.courses.audit(id, { page }), [id, page]),
    result = useResource(load, `team-audit:${id}:${page}`)
  return (
    <Panel title="Operational audit" icon="profile">
      <LoadState {...result} retry={result.reload} />
      {result.data && (
        <>
          {result.data.items.length ? (
            <DataTable
              rows={result.data.items}
              rowKey={(a) => a.key}
              columns={[
                { label: 'Time', render: (a) => formatInstant(a.occurredAt) },
                { label: 'Actor', render: (a) => a.actorName ?? `Account ${a.actorId}` },
                {
                  label: 'Action',
                  render: (a) => a.action.replaceAll('_', ' ').toLowerCase(),
                },
                { label: 'Reason', render: (a) => a.reason ?? '—' },
              ]}
            />
          ) : (
            <Status>No operational changes have been recorded.</Status>
          )}
          <Pager value={result.data} change={setPage} />
        </>
      )}
    </Panel>
  )
}
